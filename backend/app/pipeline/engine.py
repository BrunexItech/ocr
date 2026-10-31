from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np


@dataclass
class TextBlock:
    text: str
    confidence: float
    box: list[tuple[float, float]]  # 4 corner points


@dataclass
class OcrResult:
    full_text: str
    blocks: list[TextBlock]
    engine: str


class OcrEngine(Protocol):
    name: str

    def run(self, image: np.ndarray) -> OcrResult: ...


class PaddleOcrEngine:
    """Wraps PaddleOCR. Lazily loads the model so the API can start fast."""

    name = "paddleocr"

    def __init__(self, lang: str = "en", use_gpu: bool = False) -> None:
        self._lang = lang
        self._use_gpu = use_gpu
        self._model = None

    def _load(self):
        if self._model is None:
            from paddleocr import PaddleOCR

            self._model = PaddleOCR(
                use_angle_cls=True,
                lang=self._lang,
                use_gpu=self._use_gpu,
                show_log=False,
            )
        return self._model

    def run(self, image: np.ndarray) -> OcrResult:
        model = self._load()
        raw = model.ocr(image, cls=True)
        blocks: list[TextBlock] = []
        lines: list[str] = []
        for page in raw or []:
            for box, (text, conf) in page or []:
                blocks.append(TextBlock(text=text, confidence=float(conf), box=box))
                lines.append(text)
        return OcrResult(full_text="\n".join(lines), blocks=blocks, engine=self.name)


class EasyOcrEngine:
    """Wraps EasyOCR (pure-Python/pip install, no system binary required). Default engine."""

    name = "easyocr"

    def __init__(self, langs: list[str] | None = None, use_gpu: bool = False) -> None:
        self._langs = langs or ["en"]
        self._use_gpu = use_gpu
        self._model = None

    def _load(self):
        if self._model is None:
            import easyocr

            self._model = easyocr.Reader(self._langs, gpu=self._use_gpu, verbose=False)
        return self._model

    def run(self, image: np.ndarray) -> OcrResult:
        model = self._load()
        raw = model.readtext(image)
        blocks: list[TextBlock] = []
        lines: list[str] = []
        for box, text, conf in raw:
            blocks.append(TextBlock(text=text, confidence=float(conf), box=box))
            lines.append(text)
        return OcrResult(full_text="\n".join(lines), blocks=blocks, engine=self.name)


def default_engine(use_gpu: bool = False) -> "EasyOcrEngine":
    return EasyOcrEngine(use_gpu=use_gpu)
