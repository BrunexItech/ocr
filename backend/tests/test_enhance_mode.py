import numpy as np

from app.pipeline.preprocess import apply_enhance_mode


def _sample_image():
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    img[:, :, 0] = 200  # blue-ish tint so color vs grayscale is distinguishable
    return img


def test_grayscale_mode_removes_color_variation():
    out = apply_enhance_mode(_sample_image(), "grayscale")
    assert out.shape[-1] == 3
    # all channels equal once converted back from true grayscale
    assert np.all(out[:, :, 0] == out[:, :, 1]) and np.all(out[:, :, 1] == out[:, :, 2])


def test_bw_mode_produces_binary_image():
    out = apply_enhance_mode(_sample_image(), "bw")
    unique = np.unique(out)
    assert set(unique.tolist()).issubset({0, 255})


def test_color_mode_keeps_three_channels():
    out = apply_enhance_mode(_sample_image(), "color")
    assert out.shape[-1] == 3


def test_unknown_mode_falls_back_to_color():
    out = apply_enhance_mode(_sample_image(), "nonsense")
    assert out.shape[-1] == 3
