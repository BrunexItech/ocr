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


_ID_KEYWORDS = re.compile(
    r"\b(identity|identification|national\s*id|id\s*card|id\s*no|id\s*number|passport|republic\s+of|"
    r"date\s+of\s+birth|d\.?o\.?b|sex|gender|nationality|place\s+of\s+birth|date\s+of\s+issue|"
    r"date\s+of\s+expiry|expiry\s+date|serial\s+number|holder|signature)\b", re.I,
)
_INVOICE_KEYWORDS = re.compile(
    r"\b(invoice|receipt|order\s*no|subtotal|sub-total|amount\s+due|total\s+due|qty|quantity|"
    r"unit\s+price|vat|tax\s+id|payment\s+terms|bill\s+to|ship\s+to)\b", re.I,
)

_ID_LABELS = {
    "id_number": re.compile(r"\b(?:id|identity|serial)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Za-z0-9]{4,20})", re.I),
    "date_of_birth": re.compile(r"\b(?:date\s+of\s+birth|d\.?o\.?b\.?)\s*[:\-]?\s*([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})", re.I),
    "date_of_issue": re.compile(r"\bdate\s+of\s+issue\s*[:\-]?\s*([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{2,4})", re.I),
    "date_of_expiry": re.compile(r"\b(?:date\s+of\s+expiry|expiry\s+date)\s*[:\-]?\s*([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{2,4})", re.I),
    "sex": re.compile(r"\b(?:sex|gender)\s*[:\-]?\s*(male|female|[mf])\b", re.I),
    "nationality": re.compile(r"\bnationality\s*[:\-]?\s*([A-Za-z ]{3,30})(?=\n|$)", re.I),
    "full_name": re.compile(r"\b(?:full\s+name|name)\s*[:\-]?\s*([A-Za-z.'\- ]{3,60})(?=\n|$)", re.I),
}


def looks_like_id(full_text: str) -> bool:
    """Cheap keyword vote used only when there's no MRZ to go on - decides whether
    to run the ID-field heuristic or the invoice one on the OCR'd text."""
    id_hits = len(_ID_KEYWORDS.findall(full_text))
    invoice_hits = len(_INVOICE_KEYWORDS.findall(full_text))
    return id_hits > invoice_hits


def extract_id_fields(full_text: str) -> dict:
    """Label-based fallback for ID cards/passports that have no machine-readable zone
    at all (most national ID cards don't) - pulls whatever labelled fields it can find
    instead of forcing the document through the invoice extractor."""
    text = normalize_ocr_spacing(full_text)
    fields: dict = {}
    for key, pattern in _ID_LABELS.items():
        m = pattern.search(text)
        fields[key] = m.group(1).strip() if m else None
    return fields


_LABEL_VALUE_LINE = re.compile(r"^\s*([A-Za-z][A-Za-z0-9 .'/#-]{1,40}?)\s*[:\-]\s*(.+?)\s*$")


def _label_pattern(label: str) -> re.Pattern:
    escaped = re.escape(label.strip())
    spaced = re.sub(r"\\ ", r"\\s+", escaped)
    return re.compile(rf"\b{spaced}\s*[:\-]?\s*([^\n]{{1,80}})", re.I)


def extract_fields_by_schema(full_text: str, fields_schema: dict) -> dict:
    """The actual point of running OCR on a configurable document: for every field the
    admin defined (school record, hospital form, sports roster, whatever the domain),
    search the OCR'd text for that field's label and pull the value that follows it -
    instead of forcing every document through the same fixed invoice/ID shape."""
    text = normalize_ocr_spacing(full_text)
    fields: dict = {}
    for key, spec in (fields_schema or {}).items():
        label = (spec or {}).get("label") or key.replace("_", " ")
        value = None
        for candidate in (label, key.replace("_", " ")):
            m = _label_pattern(candidate).search(text)
            if m:
                value = m.group(1).strip().strip(":-").strip()
                break
        fields[key] = value or None
    return fields


def extract_generic_fields(full_text: str, limit: int = 25) -> dict:
    """Last-resort extractor for a document with no admin-configured schema and no
    invoice/ID shape: pull every 'Label: value' or 'Label - value' line straight out
    of the OCR text, so scanning still lifts *something* instead of coming back empty."""
    text = normalize_ocr_spacing(full_text)
    fields: dict = {}
    for line in text.splitlines():
        m = _LABEL_VALUE_LINE.match(line)
        if not m:
            continue
        label, value = m.group(1).strip(), m.group(2).strip()
        if not label or not value:
            continue
        key = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
        if not key or key in fields:
            continue
        fields[key] = value
        if len(fields) >= limit:
            break
    return fields
