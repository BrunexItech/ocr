"""Embeddable scanner widget backend: a parent site (e.g. sports.oqtekal.com) exchanges
its service API key for a short-lived embed token, opens the widget in an iframe with
that token, and the widget extracts fields from a capture WITHOUT ever storing the
image or the result on this server - nothing here writes to disk or the database."""
from __future__ import annotations

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth.api_key import create_embed_token, get_embed_account, get_service_account
from app.core.config import settings
from app.db.session import get_db
from app.models.base import DocumentType, ServiceAccount
from app.pipeline.classify import classify_and_extract
from app.pipeline.engine import default_engine
from app.pipeline.preprocess import preprocess_for_ocr
from sqlalchemy.orm import Session

router = APIRouter()
_engine = default_engine(use_gpu=settings.use_gpu)


@router.post("/token")
def issue_embed_token(account: ServiceAccount = Depends(get_service_account)):
    """A parent page's own backend calls this (with its long-lived API key) to get a
    short-lived token to hand to the iframe - the long-lived key itself never has to
    touch the browser."""
    token, expires_in = create_embed_token(account.id)
    return {"token": token, "expires_in": expires_in}


@router.post("/extract")
def embed_extract(
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
        {"key": k, "value": v, "confidence": round(overall_conf, 4), "bbox": None}
        for k, v in extracted.items()
    ]
    return {
        "fields": fields,
        "ocr_confidence": round(overall_conf, 4),
        "detected_kind": (
            "ID card / Passport" if (mrz_result or kind in ("id_card", "passport")) else
            "Invoice / Receipt" if "invoice_number" in extracted else "Document"
        ),
    }
