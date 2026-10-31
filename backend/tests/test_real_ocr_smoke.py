"""Smoke test with the real OCR engine (not stubbed) — confirms the installed
ML backend actually reads text from a rendered image end-to-end."""
import io

import pytest
from PIL import Image, ImageDraw


def test_default_engine_reads_rendered_text():
    pytest.importorskip("easyocr")
    from app.pipeline.engine import default_engine

    img = Image.new("RGB", (400, 120), "white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 40), "HELLO OQTEKAL", fill="black")
    import numpy as np

    arr = np.array(img)

    engine = default_engine()
    result = engine.run(arr)
    assert "OQTEKAL" in result.full_text.upper() or "HELLO" in result.full_text.upper()
    assert result.blocks
