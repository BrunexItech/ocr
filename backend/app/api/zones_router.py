"""Zone mode: a caller sends a page image plus a list of named field zones (pixel
rectangles on that image) and gets back text, confidence, script, and bounding box
per zone. This is a separate, additive endpoint - it does not touch or run during the
normal scan/intake/review flow, so it can't regress the OCR's primary use."""
from __future__ import annotations

import json

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth.api_key import get_service_account
from app.core.config import settings
from app.models.base import ServiceAccount
from app.pipeline.engine import default_engine
from app.pipeline.normalize_ke import NORMALIZERS

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


@router.post("/ocr-zones")
async def ocr_zones(
    file: UploadFile = File(...),
    zones: str = Form(...),  # JSON-encoded list of Zone, as multipart form fields can't carry nested JSON directly
    account: ServiceAccount = Depends(get_service_account),
):
    data = await file.read()
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not decode image")
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

    return {"zones": results, "handwriting_available": handwriting_ready}
