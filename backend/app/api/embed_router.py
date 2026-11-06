"""Embeddable scanner widget backend: a parent site (e.g. sports.oqtekal.com) exchanges
its service API key for a short-lived embed token, opens the widget in an iframe with
that token, and the widget extracts fields from a capture WITHOUT ever storing the
image or the result on this server - nothing here writes to disk or the database."""
from __future__ import annotations

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.auth.api_key import create_embed_token, get_embed_account, get_service_account
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.base import DocumentType, ServiceAccount
from app.pipeline.classify import classify_and_extract
from app.pipeline.engine import default_engine
from app.pipeline.preprocess import preprocess_for_ocr
from sqlalchemy.orm import Session

router = APIRouter()
_engine = default_engine(use_gpu=settings.use_gpu)


@router.post("/token")
@limiter.limit("30/minute")
def issue_embed_token(request: Request, account: ServiceAccount = Depends(get_service_account)):
    """A parent page's own backend calls this (with its long-lived API key) to get a
    short-lived token to hand to the iframe - the long-lived key itself never has to
    touch the browser."""
    token, expires_in = create_embed_token(account.id)
    return {"token": token, "expires_in": expires_in}


@router.post("/extract")
@limiter.limit("20/minute")
def embed_extract(
    request: Request,
    file: UploadFile = File(...),
    type_id: str | None = Form(None),
    kind: str | None = Form(None),
    account: ServiceAccount = Depends(get_embed_account),
    db: Session = Depends(get_db),
):
    """Runs the exact same classification/extraction the real intake flow uses
    (via classify_and_extract), but never writes the image or the result anywhere -
    the response is the only copy that will ever exist."""
    data = file.file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {settings.max_upload_mb}MB limit")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image - embed/extract accepts a single raster image (JPG/PNG/WebP)")

    doc_type = db.get(DocumentType, type_id) if type_id else None
    if type_id and not doc_type:
        raise HTTPException(400, f"Unknown document type: {type_id}")

    processed = preprocess_for_ocr(image)
    result = _engine.run(processed)
    full_text = result.full_text
    overall_conf = (
        sum(b.confidence for b in result.blocks) / len(result.blocks) if result.blocks else 0.0
    )

    extracted, mrz_result, overall_conf = classify_and_extract(
        full_text, full_text, "", kind, doc_type, overall_conf
    )

    fields = [
        {
            "key": k,
            "value": v if v else "",
            # A field we never found a labelled value for is reported as blank with
            # zero confidence - not the whole document's average score - so it reads
            # unambiguously as "not read," never as a guess.
            "confidence": round(overall_conf, 4) if v else 0.0,
            "bbox": None,
        }
        for k, v in extracted.items()
    ]
    if doc_type:
        detected_kind = doc_type.name
    elif mrz_result or kind in ("id_card", "passport"):
        detected_kind = "ID card / Passport"
    elif extracted.get("invoice_number") or extracted.get("total_amount"):
        detected_kind = "Invoice / Receipt"
    else:
        detected_kind = "Document"

    return {
        "fields": fields,
        "ocr_confidence": round(overall_conf, 4),
        "detected_kind": detected_kind,
    }
