from __future__ import annotations

import cv2
import numpy as np


def _to_gray(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def deskew(image: np.ndarray) -> np.ndarray:
    gray = _to_gray(image)
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if coords.shape[0] < 20:
        return image
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    if abs(angle) < 0.3:
        return image
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        image, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )


def denoise(image: np.ndarray) -> np.ndarray:
    return cv2.fastNlMeansDenoisingColored(image, None, 7, 7, 7, 21) if len(image.shape) == 3 else cv2.fastNlMeansDenoising(image, None, 7, 7, 21)


def adaptive_binarize(image: np.ndarray) -> np.ndarray:
    gray = _to_gray(image)
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 35, 11
    )


def auto_contrast(image: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)


def order_points(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def find_document_contour(image: np.ndarray) -> np.ndarray | None:
    """Detect the page/document boundary in a photo (CamScanner-style edge detection)."""
    h, w = image.shape[:2]
    scale = 1000.0 / max(h, w)
    if scale < 1:
        small = cv2.resize(image, (int(w * scale), int(h * scale)))
    else:
        small = image.copy()
        scale = 1.0  # no resize happened - contour coords are already full-scale

    gray = _to_gray(small)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    img_area = small.shape[0] * small.shape[1]
    for c in contours:
        area = cv2.contourArea(c)
        if area < img_area * 0.2:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype("float32") / scale
    return None


def auto_crop_and_straighten(image: np.ndarray) -> np.ndarray:
    """Find the document's 4 corners in a photo and warp it to a flat, straight-on scan.
    Falls back to the original image untouched if no clear document boundary is found
    (e.g. the input is already a clean flatbed scan filling the whole frame)."""
    contour = find_document_contour(image)
    if contour is None:
        return image
    rect = order_points(contour)
    (tl, tr, br, bl) = rect

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = max(int(width_a), int(width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = max(int(height_a), int(height_b))

    if max_width < 50 or max_height < 50:
        return image

    dst = np.array([[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]], dtype="float32")
    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, matrix, (max_width, max_height))


def sharpen(image: np.ndarray) -> np.ndarray:
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(image, -1, kernel)


def apply_enhance_mode(image: np.ndarray, mode: str = "color") -> np.ndarray:
    """CamScanner-style output look, independent of the OCR-tuned preprocessing above.
    'color' = cleaned photo, 'grayscale' = greyscale, 'bw' = high-contrast black & white."""
    if mode == "grayscale":
        gray = _to_gray(image)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR) if len(image.shape) == 3 else gray
    if mode == "bw":
        bw = adaptive_binarize(image)
        return cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR) if len(image.shape) == 3 else bw
    return auto_contrast(image) if len(image.shape) == 3 else image


def preprocess_for_ocr(image: np.ndarray, auto_crop: bool = True) -> np.ndarray:
    """Pipeline tuned for real-world document/receipt photos, not just flatbed scans.
    CamScanner-style: detect & straighten the page, then clean it up for OCR."""
    if auto_crop:
        image = auto_crop_and_straighten(image)
    image = auto_contrast(image)
    image = denoise(image)
    image = deskew(image)
    image = sharpen(image)
    return image
