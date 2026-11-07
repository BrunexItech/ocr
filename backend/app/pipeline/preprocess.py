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
    # minAreaRect's angle is only trustworthy as a small camera-tilt correction. On a
    # busy real-world photo (ID card with a photo, watermark, stamp) the foreground
    # pixels aren't dominated by text lines, and this heuristic can return a
    # degenerate ~45/90 degree reading - rotating the whole image on that reading
    # turns level text sideways and wrecks OCR rather than fixing anything. A real
    # document photo rarely needs more than a few degrees of correction, so treat
    # anything beyond that as an unreliable measurement and skip rotation entirely.
    if abs(angle) > 15:
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


def auto_white_balance(image: np.ndarray, percentile: float = 1.0) -> np.ndarray:
    """Removes the color cast real camera photos pick up from ambient lighting
    (the yellow/orange tint from indoor bulbs, the green tint from fluorescent
    light) so a white page actually reads as white and colors look true-to-life,
    not tinted by whatever light it was scanned under. Standard "simplest color
    balance" algorithm: stretch each color channel independently so its darkest
    ~1% and brightest ~1% of pixels hit true black/white, instead of leaving
    everything shifted toward one color. Pure numpy/OpenCV - no extra packages."""
    if len(image.shape) != 3:
        return image
    result = image.astype(np.float32)
    for c in range(3):
        channel = result[:, :, c]
        low, high = np.percentile(channel, (percentile, 100 - percentile))
        if high > low:
            result[:, :, c] = np.clip((channel - low) * 255.0 / (high - low), 0, 255)
    return result.astype(np.uint8)


def auto_contrast(image: np.ndarray) -> np.ndarray:
    balanced = auto_white_balance(image) if len(image.shape) == 3 else image
    lab = cv2.cvtColor(balanced, cv2.COLOR_BGR2LAB)
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


def _largest_quad_from_edges(edges: np.ndarray, img_area: float) -> np.ndarray | None:
    """Given a binary edge/mask image, returns either a clean 4-point polygon for
    the largest sufficiently-big contour, or that contour's rotated bounding box as
    a fallback, or None if nothing big enough was found at all."""
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    min_area = img_area * 0.1
    best_large_contour = None
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        if best_large_contour is None:
            best_large_contour = c
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype("float32")

    if best_large_contour is not None:
        return cv2.boxPoints(cv2.minAreaRect(best_large_contour)).astype("float32")
    return None


def find_document_contour(image: np.ndarray) -> np.ndarray | None:
    """Detect the page/document boundary in a photo (CamScanner-style edge detection).
    Tries plain Canny edges first (works well for most photos); if that finds nothing
    big enough - common for a light document photographed on a similarly light
    background, where there's barely any brightness edge for Canny to latch onto at
    all - falls back to adaptive thresholding, which picks up the page's shadow/
    texture boundary even when a straight brightness-gradient edge isn't there."""
    h, w = image.shape[:2]
    scale = 1000.0 / max(h, w)
    if scale < 1:
        small = cv2.resize(image, (int(w * scale), int(h * scale)))
    else:
        small = image.copy()
        scale = 1.0  # no resize happened - contour coords are already full-scale

    gray = _to_gray(small)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    img_area = small.shape[0] * small.shape[1]

    canny_edges = cv2.Canny(blurred, 50, 150)
    canny_edges = cv2.dilate(canny_edges, np.ones((3, 3), np.uint8), iterations=1)
    quad = _largest_quad_from_edges(canny_edges, img_area)
    if quad is not None:
        return quad / scale

    adaptive = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 35, 3)
    adaptive = cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8), iterations=3)
    quad = _largest_quad_from_edges(adaptive, img_area)
    if quad is not None:
        return quad / scale
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


def stack_vertical(images: list[np.ndarray], labels: list[str] | None = None) -> np.ndarray:
    """Stitch cropped pages (e.g. the front/back of an ID card, or several pages of a
    document scanned one at a time) into one image, so a multi-page scan still
    stores/previews/downloads as a single file like any other document. Each page
    gets a labelled card on a clean white mat with generous breathing room, instead
    of butting the scans together with a thin grey line. `labels` lets the caller
    say what each page actually is ("FRONT"/"BACK" for a two-sided ID, "PAGE 1"/
    "PAGE 2"/... for a plain multi-page document) - defaults to "PAGE N" for all of
    them when not given."""
    if len(images) == 1:
        return images[0]

    outer_pad, gap, label_h = 28, 56, 34
    width = max(img.shape[1] for img in images)
    canvas_width = width + outer_pad * 2

    rows: list[np.ndarray] = []
    for i, img in enumerate(images):
        h, w = img.shape[:2]
        if w != width:
            img = cv2.resize(img, (width, int(h * width / w)))
        label = labels[i] if labels and i < len(labels) else f"PAGE {i + 1}"
        label_row = np.full((label_h, width, 3), 255, dtype=np.uint8)
        cv2.putText(label_row, label, (0, label_h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2, cv2.LINE_AA)
        rows.append(np.vstack([label_row, img]))

    gap_row = np.full((gap, width, 3), 255, dtype=np.uint8)
    stacked = rows[0]
    for row in rows[1:]:
        stacked = np.vstack([stacked, gap_row, row])

    side_pad = np.full((stacked.shape[0], outer_pad, 3), 255, dtype=np.uint8)
    top_bottom_pad = np.full((outer_pad, canvas_width, 3), 255, dtype=np.uint8)
    body = np.hstack([side_pad, stacked, side_pad])
    return np.vstack([top_bottom_pad, body, top_bottom_pad])


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
