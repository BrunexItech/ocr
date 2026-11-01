import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_roles
from app.core.audit import record
from app.core.config import settings
from app.core.masking import mask_fields
from app.core.validation import validate_fields
from app.db.session import get_db
from app.models.base import Document, DocumentType, DocumentVersion, Integration, Role, User
from app.pipeline.engine import default_engine
from app.pipeline.extract_fields import (
    extract_fields_by_schema,
    extract_generic_fields,
    extract_id_fields,
    extract_invoice_fields,
    looks_like_id,
)
from app.pipeline.loader import load_pages
from app.pipeline.mrz import find_and_parse_mrz, mrz_to_fields
from app.pipeline.preprocess import apply_enhance_mode, auto_crop_and_straighten, find_document_contour, preprocess_for_ocr, stack_vertical

router = APIRouter()

_engine = default_engine(use_gpu=settings.use_gpu)
STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "application/pdf"}


def _tracking_no() -> str:
    return "OQ-" + uuid.uuid4().hex[:10].upper()


class DocOut(BaseModel):
    id: str
    tracking_no: str
    title: str | None
    status: str
    type_id: str | None
    sensitivity: str
    file_name: str
    ocr_confidence: float | None
    fields: dict
    field_confidence: dict
    reasons: list
    locked: bool
    detected_kind: str = "Document"

    class Config:
        from_attributes = True


def _detect_kind(fields: dict) -> str:
    """Human-readable label for what the extractor recognised, derived from which
    field shape came back (MRZ/ID-heuristic fields vs invoice/receipt fields) - no
    extra DB column needed since this is computed from the extracted data itself."""
    if any(k in fields for k in ("mrz_checksum_valid", "document_number", "surname", "id_number", "date_of_birth")):
        return "ID card / Passport"
    if any(k in fields for k in ("invoice_number", "total_amount")):
        return "Invoice / Receipt"
    return "Document"


def _doc_to_out(d: Document, user: User, db: Session, reveal: bool = False) -> dict:
    dt = db.get(DocumentType, d.type_id) if d.type_id else None
    out = DocOut.model_validate(d).model_dump()
    out["fields"] = mask_fields(d.fields, dt, Role(user.role), reveal)
    out["detected_kind"] = _detect_kind(d.fields)
    return out


@router.post("/detect-frame")
async def detect_frame(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Lightweight live-preview check: is there a document-shaped quad in this frame?
    Reuses the same proven contour detector that the real intake pipeline uses for
    auto-crop, so the live scanner's "found it" feedback matches what actually gets
    cropped on capture."""
    data = await file.read()
    try:
        arr = np.frombuffer(data, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        image = None
    if image is None:
        return {"found": False}
    contour = find_document_contour(image)
    if contour is None:
        return {"found": False}
    h, w = image.shape[:2]
    points = [{"x": float(p[0]), "y": float(p[1])} for p in contour]
    return {"found": True, "points": points, "width": w, "height": h}


@router.post("/crop-preview")
async def crop_preview(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Trims a just-captured photo down to the document itself - same auto-crop/
    straighten the real intake pipeline uses - so the review screen shown right after
    capture matches what actually gets stored, instead of the raw, uncropped photo."""
    data = await file.read()
    try:
        image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        image = None
    if image is None:
        raise HTTPException(400, "Could not decode image")
    cropped = auto_crop_and_straighten(image)
    ok, buf = cv2.imencode(".jpg", cropped, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise HTTPException(500, "Failed to crop preview")
    return Response(content=buf.tobytes(), media_type="image/jpeg")


@router.post("/intake", response_model=DocOut)
async def intake(
    file: UploadFile = File(...),
    file_back: UploadFile | None = File(None),  # ID cards carry data on both sides
    type_id: str | None = None,
    title: str | None = None,
    kind: str | None = None,  # optional hint from the scan-mode card: document | id_card | passport
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.admin, Role.intake)),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {settings.max_upload_mb}MB limit")

    back_data: bytes | None = None
    if file_back is not None:
        if file_back.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, f"Unsupported file type: {file_back.content_type}")
        back_data = await file_back.read()
        if len(back_data) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(400, f"File exceeds {settings.max_upload_mb}MB limit")

    doc_type = db.get(DocumentType, type_id) if type_id else None
    if type_id and not doc_type:
        raise HTTPException(400, f"Unknown document type: {type_id}")

    try:
        front_pages = load_pages(data, file.content_type)
        back_pages = load_pages(back_data, file_back.content_type) if back_data else []
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    tracking_no = _tracking_no()
    if back_pages:
        # A two-sided scan (front + back) is stitched into one image so it stores,
        # previews, and downloads as a single file, same as any other document.
        straightened_pages = [auto_crop_and_straighten(p) for p in front_pages + back_pages]
        stored_image = stack_vertical(straightened_pages)
        ok, buf = cv2.imencode(".jpg", stored_image, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not ok:
            raise HTTPException(500, "Failed to combine front/back scan")
        stem = Path(file.filename).stem or "scan"
        stored_name = f"{stem}.jpg"
        dest = STORAGE_DIR / f"{tracking_no}_{stored_name}"
        dest.write_bytes(buf.tobytes())
    else:
        stored_name = file.filename
        dest = STORAGE_DIR / f"{tracking_no}_{stored_name}"
        dest.write_bytes(data)

    doc = Document(tracking_no=tracking_no, title=(title or "").strip() or None, type_id=type_id,
                    file_name=stored_name, file_path=str(dest), pre_cropped=bool(back_pages),
                    sensitivity=doc_type.default_sensitivity if doc_type else "internal",
                    created_by=user.id, status="processing")
    db.add(doc)
    db.flush()
    record(db, user=user.name, role=user.role, action="intake.register", document_id=doc.id,
           detail=f"Registered {file.filename}" + (" (front + back)" if back_pages else ""))

    texts, confidences = [], []
    for page_image in front_pages + back_pages:
        processed = preprocess_for_ocr(page_image)
        result = _engine.run(processed)
        texts.append(result.full_text)
        if result.blocks:
            confidences.append(sum(b.confidence for b in result.blocks) / len(result.blocks))

    front_text = "\n\n".join(texts[: len(front_pages)])
    back_text = "\n\n".join(texts[len(front_pages):])
    full_text = "\n\n".join(texts)
    overall_conf = sum(confidences) / len(confidences) if confidences else 0.0

    looks_identity = kind in ("id_card", "passport") or (doc_type and doc_type.domain == "identity")
    treat_as_identity = looks_identity or (kind is None and not doc_type and looks_like_id(full_text))

    mrz_result = find_and_parse_mrz(full_text) if (treat_as_identity or not doc_type) else None
    if mrz_result:
        extracted = mrz_to_fields(mrz_result)
        if not mrz_result.valid:
            overall_conf = min(overall_conf, 0.5)
    elif treat_as_identity:
        # Most ID cards (unlike passports) don't carry a machine-readable zone at all -
        # fall back to pulling labelled fields straight out of the OCR text instead of
        # forcing the document through the invoice extractor. When there's a back side,
        # merge both: either side can carry a field the other is missing.
        extracted = extract_id_fields(front_text)
        if back_text:
            for k, v in extract_id_fields(back_text).items():
                if not extracted.get(k) and v:
                    extracted[k] = v
    elif doc_type and doc_type.fields_schema:
        # The actual point of OCR: pull whatever the admin configured for this document
        # type (school record, hospital form, sports roster, ...) straight out of the
        # text, instead of always forcing it through the invoice-shaped extractor.
        extracted = extract_fields_by_schema(full_text, doc_type.fields_schema)
        invoice_guess = extract_invoice_fields(full_text)
        for k in extracted:
            if not extracted[k] and k in invoice_guess and invoice_guess[k]:
                extracted[k] = invoice_guess[k]
    else:
        extracted = extract_invoice_fields(full_text)
        for k, v in extract_generic_fields(full_text).items():
            extracted.setdefault(k, v)

    doc.ocr_text = full_text
    doc.ocr_confidence = overall_conf
    doc.fields = extracted
    doc.field_confidence = {k: overall_conf for k in extracted}

    errors = validate_fields(extracted, doc_type)
    reasons = [e["message"] for e in errors]
    if overall_conf < settings.review_confidence_threshold:
        reasons.append(f"Low OCR confidence ({overall_conf:.0%})")
    if mrz_result is not None and not mrz_result.valid:
        reasons.append("MRZ checksum failed - document may be damaged, forged, or misread")
    doc.reasons = reasons
    doc.status = "awaiting_review" if reasons else "awaiting_approval"
    doc.versions.append(DocumentVersion(version=1, note="Automated OCR extraction", changes=[], user="OCR pipeline"))

    record(db, user=user.name, role=user.role, action="ocr.completed", document_id=doc.id,
           detail=f"Confidence {overall_conf:.2%} -> {doc.status}")
    db.commit()
    return _doc_to_out(doc, user, db)


@router.get("/", response_model=list[DocOut])
def list_documents(status: str | None = None, q: str | None = None, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    query = db.query(Document)
    if status:
        query = query.filter(Document.status == status)
    docs = query.order_by(Document.created_at.desc()).all()
    if q:
        needle = q.strip().lower()
        docs = [d for d in docs if needle in _searchable_text(d)]
    return [_doc_to_out(d, user, db) for d in docs]


def _searchable_text(d: Document) -> str:
    """Everything a search box should match against: the name someone gave it, its
    tracking number, the raw OCR text, and every extracted field value."""
    parts = [d.title or "", d.tracking_no, d.file_name, d.ocr_text or ""]
    parts.extend(str(v) for v in d.fields.values())
    return " ".join(parts).lower()


class RenameBody(BaseModel):
    title: str


@router.patch("/{doc_id}/rename", response_model=DocOut)
def rename_document(doc_id: str, body: RenameBody, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.title = body.title.strip() or None
    record(db, user=user.name, role=user.role, action="document.rename", document_id=doc.id,
           detail=f"Renamed to {doc.title!r}")
    db.commit()
    return _doc_to_out(doc, user, db)


@router.get("/{doc_id}", response_model=DocOut)
def get_document(doc_id: str, reveal: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if reveal and Role(user.role) in (Role.admin, Role.approver):
        record(db, user=user.name, role=user.role, action="sensitive.reveal", document_id=doc.id)
        db.commit()
    return _doc_to_out(doc, user, db, reveal=reveal)


@router.delete("/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db),
                     user: User = Depends(require_roles(Role.admin, Role.intake, Role.reviewer, Role.approver))):
    """A saved-but-not-yet-accepted scan (anything short of approved) can be thrown
    away outright - no point making someone reject-then-live-with a mis-scan forever
    when they never meant to keep it in the first place."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status == "approved":
        raise HTTPException(409, "Approved documents can't be deleted - reject it first if it shouldn't be kept")
    if doc.locked:
        raise HTTPException(409, "Document is locked; an admin must unlock it first")

    file_path, file_name, status_was = doc.file_path, doc.file_name, doc.status
    record(db, user=user.name, role=user.role, action="document.delete", document_id=doc.id,
           detail=f"Deleted {file_name} (status was {status_was})")
    db.delete(doc)
    db.commit()
    Path(file_path).unlink(missing_ok=True)
    return {"ok": True}


class FieldUpdate(BaseModel):
    fields: dict
    note: str = "Reviewer corrections"


@router.patch("/{doc_id}/fields", response_model=DocOut)
def correct_fields(doc_id: str, body: FieldUpdate, db: Session = Depends(get_db),
                    user: User = Depends(require_roles(Role.admin, Role.reviewer, Role.approver))):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.locked:
        raise HTTPException(409, "Document is locked; an admin must unlock it first")
    changes = [{"field": k, "from": doc.fields.get(k), "to": v} for k, v in body.fields.items() if doc.fields.get(k) != v]
    if not changes:
        return _doc_to_out(doc, user, db)
    doc.fields = {**doc.fields, **body.fields}
    doc_type = db.get(DocumentType, doc.type_id) if doc.type_id else None
    errors = validate_fields(doc.fields, doc_type)
    doc.reasons = [e["message"] for e in errors]
    next_version = (doc.versions[-1].version + 1) if doc.versions else 1
    doc.versions.append(DocumentVersion(version=next_version, note=body.note, changes=changes, user=user.name))
    record(db, user=user.name, role=user.role, action="review.correct", document_id=doc.id,
           detail=f"{len(changes)} field(s) corrected")
    db.commit()
    return _doc_to_out(doc, user, db)


@router.post("/{doc_id}/submit", response_model=DocOut)
def submit_for_approval(doc_id: str, db: Session = Depends(get_db),
                         user: User = Depends(require_roles(Role.admin, Role.reviewer))):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "awaiting_review":
        raise HTTPException(409, f"Cannot submit a document in status '{doc.status}'")
    doc_type = db.get(DocumentType, doc.type_id) if doc.type_id else None
    errors = validate_fields(doc.fields, doc_type)
    if errors:
        raise HTTPException(400, f"Resolve {len(errors)} validation error(s) before submitting")
    doc.status = "awaiting_approval"
    doc.reasons = []
    record(db, user=user.name, role=user.role, action="review.submit", document_id=doc.id)
    db.commit()
    return _doc_to_out(doc, user, db)


@router.post("/{doc_id}/approve", response_model=DocOut)
def approve_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin, Role.approver))):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "awaiting_approval":
        raise HTTPException(409, f"Cannot approve a document in status '{doc.status}' - it must be awaiting_approval")
    doc_type = db.get(DocumentType, doc.type_id) if doc.type_id else None
    errors = validate_fields(doc.fields, doc_type)
    if errors:
        raise HTTPException(400, f"Cannot approve: {len(errors)} validation error(s) remain")
    doc.status = "approved"
    doc.locked = True
    from datetime import datetime
    doc.approved_at = datetime.utcnow()
    doc.approved_by = user.id
    record(db, user=user.name, role=user.role, action="approve.final", document_id=doc.id, detail="Approved & locked")
    db.commit()
    return _doc_to_out(doc, user, db)


@router.post("/{doc_id}/reject", response_model=DocOut)
def reject_document(doc_id: str, reason: str = "Rejected", db: Session = Depends(get_db),
                     user: User = Depends(require_roles(Role.admin, Role.approver))):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in ("awaiting_review", "awaiting_approval"):
        raise HTTPException(409, f"Cannot reject a document in status '{doc.status}'")
    doc.status = "rejected"
    doc.reasons = [reason]
    record(db, user=user.name, role=user.role, action="approve.reject", document_id=doc.id, detail=reason)
    db.commit()
    return _doc_to_out(doc, user, db)


@router.get("/{doc_id}/download/original")
def download_original(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    record(db, user=user.name, role=user.role, action="record.download", document_id=doc.id, detail="Original file")
    db.commit()
    return FileResponse(doc.file_path, filename=doc.file_name)


@router.get("/{doc_id}/download/text")
def download_text(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    record(db, user=user.name, role=user.role, action="record.download", document_id=doc.id, detail="Extracted text")
    db.commit()
    return JSONResponse({"text": doc.ocr_text})


@router.get("/{doc_id}/preview")
def preview_image(doc_id: str, mode: str = "color", page: int = 1, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """CamScanner-style preview: auto-cropped/straightened page in the chosen look
    (color / grayscale / bw), rendered on the fly from the immutable original."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    data = Path(doc.file_path).read_bytes()
    content_type = "application/pdf" if doc.file_name.lower().endswith(".pdf") else "image/jpeg"
    pages = load_pages(data, content_type)
    if page < 1 or page > len(pages):
        raise HTTPException(400, f"Page {page} out of range (document has {len(pages)} page(s))")
    straightened = pages[page - 1] if doc.pre_cropped else auto_crop_and_straighten(pages[page - 1])
    enhanced = apply_enhance_mode(straightened, mode)
    ok, buf = cv2.imencode(".jpg", enhanced, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise HTTPException(500, "Failed to render preview")
    return Response(content=buf.tobytes(), media_type="image/jpeg")


class PushRequest(BaseModel):
    integration_id: str
    fields: list[str]  # which field keys to push


@router.post("/{doc_id}/push")
def push_to_database(doc_id: str, body: PushRequest, db: Session = Depends(get_db),
                      user: User = Depends(require_roles(Role.admin, Role.approver))):
    """Push a selected subset of approved fields to a configured downstream integration."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "approved":
        raise HTTPException(400, "Only approved records can be pushed")
    integration = db.get(Integration, body.integration_id)
    if not integration or not integration.active:
        raise HTTPException(404, "Integration not found or inactive")

    payload = {k: doc.fields.get(k) for k in body.fields}
    if integration.kind == "webhook":
        import httpx
        try:
            httpx.post(integration.config["url"], json={"tracking_no": doc.tracking_no, "fields": payload}, timeout=10)
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Push failed: {exc}") from exc
    record(db, user=user.name, role=user.role, action="record.push", document_id=doc.id,
           detail=f"Pushed {len(payload)} field(s) to {integration.name}")
    db.commit()
    return {"pushed": payload, "integration": integration.name}
