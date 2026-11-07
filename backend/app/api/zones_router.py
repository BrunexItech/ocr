"""Zone mode: a caller sends a page image plus a list of named field zones (pixel
rectangles on that image) and gets back text, confidence, script, and bounding box
per zone. This is a separate, additive endpoint - it does not touch or run during the
normal scan/intake/review flow, so it can't regress the OCR's primary use."""
from __future__ import annotations

import json

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.auth.api_key import get_service_account
from app.core.config import settings
from app.core.limiter import limiter
from app.models.base import ServiceAccount
from app.pipeline.engine import default_engine
from app.pipeline.normalize_ke import NORMALIZERS
from app.pipeline.preprocess import preprocess_for_ocr

router = APIRouter()
_printed_engine = default_engine()


class Zone(BaseModel):
    key: str
    x: int
    y: int
    width: int
    height: int
    expected_script: str | None = None  # "printed" | "handwritten" | None (try both, keep the better one)
    normalize: str | None = None  # one of normalize_ke.NORMALIZERS, e.g. "phone", "kra_pin", "id_number", "date"


class ZoneRequest(BaseModel):
    zones: list[Zone]


def _crop(image: np.ndarray, z: Zone) -> np.ndarray | None:
    h, w = image.shape[:2]
    x0, y0 = max(0, z.x), max(0, z.y)
    x1, y1 = min(w, z.x + z.width), min(h, z.y + z.height)
    if x1 <= x0 or y1 <= y0:
        return None
    return image[y0:y1, x0:x1]


def _read_printed(crop: np.ndarray) -> tuple[str, float]:
    result = _printed_engine.run(crop)
    if not result.blocks:
        return "", 0.0
    text = " ".join(b.text for b in result.blocks)
    confidence = sum(b.confidence for b in result.blocks) / len(result.blocks)
    return text.strip(), confidence


MAX_DIMENSION = 6000  # px, either side - generous for a phone/scanner photo, guards against absurd uploads


@router.get("/zones-health")
def zones_health(account: ServiceAccount = Depends(get_service_account)):
    """Key-authenticated connectivity check for the zone service specifically -
    confirms both that the server is reachable AND that this exact key is valid."""
    return {"ok": True, "service": "ocr-zones", "account": account.name}


@router.post("/ocr-text")
@limiter.limit("20/minute")
def ocr_text(
    request: Request,
    file: UploadFile = File(...),
    account: ServiceAccount = Depends(get_service_account),
):
    """Diagnostic/design-time endpoint: send an image, get back every text line the
    OCR engine actually sees - its text, confidence, and pixel bounding box - plus
    the image dimensions those boxes are in. Use this to find out exactly how a real
    document reads (label wording, same-line vs next-line layout, where on the page
    a field sits) before writing a schema's field labels or a zones request, instead
    of guessing. Runs the same preprocessing as the real intake flow, so what you see
    here is what classify_and_extract/extract_fields_by_schema would have seen too."""
    data = file.file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {settings.max_upload_mb}MB limit")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image - ocr-text accepts single raster images (JPG/PNG/WebP) only, not PDF")
    img_h, img_w = image.shape[:2]
    if img_h > MAX_DIMENSION or img_w > MAX_DIMENSION:
        raise HTTPException(400, f"Image too large ({img_w}x{img_h}); max {MAX_DIMENSION}px on a side")

    processed = preprocess_for_ocr(image)
    result = _printed_engine.run(processed)
    lines = [
        {"text": b.text, "confidence": round(b.confidence, 4), "bbox": b.box}
        for b in result.blocks
    ]
    overall_conf = sum(b.confidence for b in result.blocks) / len(result.blocks) if result.blocks else 0.0

    return {
        "lines": lines,
        "full_text": result.full_text,
        "ocr_confidence": round(overall_conf, 4),
        "image_width": img_w,
        "image_height": img_h,
    }


@router.post("/ocr-zones")
def ocr_zones(
    file: UploadFile = File(...),
    zones: str = Form(...),  # JSON-encoded list of Zone, as multipart form fields can't carry nested JSON directly
    account: ServiceAccount = Depends(get_service_account),
):
    # Plain `def`, not `async def`: this does real CPU-bound OCR work, so FastAPI runs
    # it in its worker thread pool instead of blocking the single event loop thread -
    # one slow zone request no longer stalls every other request (including health
    # checks) on the same server process.
    data = file.file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {settings.max_upload_mb}MB limit")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image - ocr-zones accepts single raster images "
                                  "(JPG/PNG/WebP) only, not PDF")
    img_h, img_w = image.shape[:2]
    if img_h > MAX_DIMENSION or img_w > MAX_DIMENSION:
        raise HTTPException(400, f"Image too large ({img_w}x{img_h}); max {MAX_DIMENSION}px on a side")
    try:
        parsed = ZoneRequest(zones=json.loads(zones))
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise HTTPException(400, f"Invalid zones payload: {exc}") from exc

    handwriting_ready = False
    if settings.enable_handwriting:
        from app.pipeline.handwriting import is_available

        handwriting_ready = is_available()

    results = []
    for z in parsed.zones:
        crop = _crop(image, z)
        if crop is None:
            results.append({"key": z.key, "text": None, "confidence": 0.0, "script": "unknown",
                             "bbox": [z.x, z.y, z.width, z.height], "normalized": None,
                             "error": "zone is outside the image bounds"})
            continue

        if z.expected_script == "handwritten" and not handwriting_ready:
            # Handwriting is off (ENABLE_HANDWRITING=false) - report this explicitly as
            # an unread handwritten field (blank text, low confidence, script correctly
            # tagged "handwritten") rather than silently falling back to printed OCR or
            # guessing, so it's unambiguous that a human needs to type this one in.
            results.append({"key": z.key, "text": "", "confidence": 0.0, "script": "handwritten",
                             "bbox": [z.x, z.y, z.width, z.height], "normalized": None})
            continue

        want_handwritten = z.expected_script == "handwritten" or (z.expected_script is None and handwriting_ready)
        want_printed = z.expected_script != "handwritten"

        candidates: list[tuple[str, str, float]] = []  # (script, text, confidence)
        if want_printed:
            text, conf = _read_printed(crop)
            if text:
                candidates.append(("printed", text, conf))
        if want_handwritten and handwriting_ready:
            from app.pipeline.handwriting import read_handwritten

            text, conf = read_handwritten(crop)
            if text:
                candidates.append(("handwritten", text, conf))

        if not candidates:
            script, text, confidence = "unknown", None, 0.0
        else:
            script, text, confidence = max(candidates, key=lambda c: c[2])

        normalized = None
        if text and z.normalize:
            fn = NORMALIZERS.get(z.normalize)
            if fn:
                normalized = fn(text)

        results.append({
            "key": z.key, "text": text, "confidence": round(confidence, 4), "script": script,
            "bbox": [z.x, z.y, z.width, z.height], "normalized": normalized,
        })

    return {
        "zones": results,
        "handwriting_available": handwriting_ready,
        "image_width": img_w,
        "image_height": img_h,
    }
