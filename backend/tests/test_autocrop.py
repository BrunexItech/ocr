import cv2
import numpy as np

from app.pipeline.preprocess import auto_crop_and_straighten, find_document_contour, order_points


def _make_photo_of_document(angle_deg=12, pad=250):
    """Simulate a CamScanner-style photo: a white page on a darker background, rotated."""
    page_w, page_h = 500, 700
    canvas = np.full((page_h + pad * 2, page_w + pad * 2, 3), 40, dtype=np.uint8)  # dark background
    canvas[pad:pad + page_h, pad:pad + page_w] = 255  # white page
    cv2.putText(canvas, "DOCUMENT", (pad + 60, pad + 350), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 3)

    center = (canvas.shape[1] // 2, canvas.shape[0] // 2)
    matrix = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
    rotated = cv2.warpAffine(canvas, matrix, (canvas.shape[1], canvas.shape[0]), borderValue=(40, 40, 40))
    return rotated, (page_w, page_h)


def test_order_points_sorts_corners_consistently():
    pts = np.array([[10, 10], [10, 0], [0, 0], [0, 10]], dtype="float32")
    ordered = order_points(pts)
    tl, tr, br, bl = ordered
    assert tl[0] <= tr[0] and tl[1] <= bl[1]
    assert br[0] >= bl[0] and br[1] >= tr[1]


def test_find_document_contour_detects_page_boundary():
    photo, (page_w, page_h) = _make_photo_of_document()
    contour = find_document_contour(photo)
    assert contour is not None
    assert contour.shape == (4, 2)


def test_auto_crop_straightens_rotated_document():
    photo, (page_w, page_h) = _make_photo_of_document(angle_deg=12)
    result = auto_crop_and_straighten(photo)
    # Should be roughly the size of the original page, not the padded photo
    assert abs(result.shape[0] - page_h) < page_h * 0.15
    assert abs(result.shape[1] - page_w) < page_w * 0.15


def test_auto_crop_leaves_image_unchanged_when_no_document_found():
    blank = np.full((300, 300, 3), 128, dtype=np.uint8)  # featureless, no page boundary
    result = auto_crop_and_straighten(blank)
    assert result.shape == blank.shape
