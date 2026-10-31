from __future__ import annotations

import re

_MONEY = re.compile(r"(?:ksh|kes|usd|\$|€|£)?\s*([\d]{1,3}(?:[,.\s]\d{3})*(?:\.\d{2})?)", re.I)
_DATE = re.compile(
    r"\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}"
    r"|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b"
)
_TOTAL_LABELS = re.compile(r"\b(grand\s*total|total\s*due|total|amount\s*due|balance\s*due)\b", re.I)
_INVOICE_NO = re.compile(r"\b(invoice|receipt|order)\s*(?:no\.?|#|number)?\s*[:\-]?\s*([A-Za-z0-9\-/]+)", re.I)

# OCR word-level segmentation often inserts spaces around punctuation that was tight in the
# original print (e.g. "05 /10 /2026", "12,345 . 00"). Close those gaps before field regexes
# run, so real-world OCR output matches as reliably as clean text does.
_SPACE_BEFORE_PUNCT = re.compile(r"(?<=\d)\s+(?=[/\-.,])")
_SPACE_AFTER_PUNCT = re.compile(r"(?<=[/\-.,])\s+(?=\d)")


def normalize_ocr_spacing(text: str) -> str:
    text = _SPACE_BEFORE_PUNCT.sub("", text)
    text = _SPACE_AFTER_PUNCT.sub("", text)
    return text


def extract_invoice_fields(full_text: str) -> dict:
    full_text = normalize_ocr_spacing(full_text)
    lines = [l.strip() for l in full_text.splitlines() if l.strip()]

    dates = _DATE.findall(full_text)
    invoice_match = _INVOICE_NO.search(full_text)

    total = None
    for line in lines:
        if _TOTAL_LABELS.search(line):
            amounts = _MONEY.findall(line)
            if amounts:
                total = amounts[-1]
                break
    if total is None:
        # Label word itself may be OCR-garbled (e.g. "Total" -> "Tota") on low-quality
        # scans; fall back to the last money-shaped amount in the document as a best guess.
        all_amounts = _MONEY.findall(full_text)
        if all_amounts:
            total = all_amounts[-1]

    return {
        "invoice_number": invoice_match.group(2) if invoice_match else None,
        "date": dates[0] if dates else None,
        "dates_found": dates,
        "total_amount": total,
        "line_count": len(lines),
    }
