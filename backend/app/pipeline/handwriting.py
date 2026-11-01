"""Optional handwritten-text engine (TrOCR). Not wired into the main scan/intake flow -
only the zone-mode endpoint can reach it, and only when settings.enable_handwriting is
on, since loading it pulls in torch+transformers and costs real CPU time per field.
Benchmarked (CPU, base model): ~250s one-time model load, ~1.5-2.5s per cropped field
afterward. Accuracy on genuinely messy real handwriting will be lower than clean print -
treat it as a second opinion to offer alongside the printed-text reading, not a
replacement for a human reviewing low-confidence fields."""
from __future__ import annotations

import numpy as np

_model = None
_processor = None


def _load():
    global _model, _processor
    if _model is None:
        import cv2
        from PIL import Image  # noqa: F401 (import kept local to this optional dependency)
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel

        _processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
        _model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
        globals()["cv2"] = cv2
        globals()["Image"] = Image
    return _model, _processor


def read_handwritten(image: np.ndarray) -> tuple[str, float]:
    """Returns (text, confidence) for a single cropped field image. Confidence is the
    model's own per-token generation score averaged over the output, not a calibrated
    probability - treat it as relative, not absolute."""
    model, processor = _load()
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(rgb)
    pixel_values = processor(images=pil_image, return_tensors="pt").pixel_values
    import torch

    with torch.no_grad():
        out = model.generate(pixel_values, max_new_tokens=32, output_scores=True, return_dict_in_generate=True)
    text = processor.batch_decode(out.sequences, skip_special_tokens=True)[0].strip()
    scores = out.scores
    if scores:
        probs = [torch.softmax(s, dim=-1).max().item() for s in scores]
        confidence = float(sum(probs) / len(probs))
    else:
        confidence = 0.0
    return text, confidence


def is_available() -> bool:
    try:
        import transformers  # noqa: F401
        import torch  # noqa: F401
    except ImportError:
        return False
    return True
