from __future__ import annotations

import fitz  # pymupdf
import numpy as np
import cv2


def load_pages(data: bytes, content_type: str) -> list[np.ndarray]:
    """Returns a list of BGR numpy images, one per page."""
    if content_type == "application/pdf":
        return _load_pdf(data)
    return [_load_image(data)]


def _load_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image")
    return image


def _load_pdf(data: bytes, dpi: int = 300) -> list[np.ndarray]:
    doc = fitz.open(stream=data, filetype="pdf")
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    pages = []
    for page in doc:
        pix = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        pages.append(cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    return pages
