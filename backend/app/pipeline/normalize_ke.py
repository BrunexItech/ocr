"""Kenya-specific field normalizers. Pure, dependency-free transforms applied on top
of whatever the extractor already pulled out of the OCR text - never change the raw
extracted value in place, just offer a cleaned/validated version alongside it."""
from __future__ import annotations

import re
from datetime import datetime

_KE_PHONE = re.compile(r"(?:\+?254|0)?\s*([71]\d{2})[\s\-]?(\d{3})[\s\-]?(\d{3})")
_KRA_PIN = re.compile(r"\b([AP])\s*[- ]?\s*(\d{9})\s*[- ]?\s*([A-Z])\b", re.I)
_ID_NUMBER = re.compile(r"\b(\d{6,9})\b")

_DATE_FORMATS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
    "%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d",
    "%d/%m/%y", "%d-%m-%y",
    "%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y",
    "%d %B %Y", "%d %b %Y",
]


def normalize_phone_ke(raw: str | None) -> str | None:
    """Kenyan mobile numbers to E.164 (+254XXXXXXXXX). Accepts 07.., 01.., +254.., 254..
    with arbitrary spacing/dashes. Returns None if it doesn't look like a Kenyan mobile
    number at all, rather than guessing."""
    if not raw:
        return None
    digits_only = re.sub(r"[^\d+]", "", raw)
    m = _KE_PHONE.search(digits_only)
    if not m:
        return None
    local = "0" + m.group(1) + m.group(2) + m.group(3)
    if len(local) != 10:
        return None
    return "+254" + local[1:]


def normalize_kra_pin(raw: str | None) -> str | None:
    """KRA PIN to the canonical A123456789Z shape. Returns None if the text doesn't
    contain something matching that pattern."""
    if not raw:
        return None
    m = _KRA_PIN.search(raw.upper())
    if not m:
        return None
    return f"{m.group(1)}{m.group(2)}{m.group(3)}"


def normalize_id_number(raw: str | None) -> str | None:
    """Kenyan national ID numbers are 6-9 digits. Strips spaces/punctuation and
    returns the digit run, or None if nothing digit-shaped in that range is found."""
    if not raw:
        return None
    m = _ID_NUMBER.search(raw)
    return m.group(1) if m else None


def normalize_date_iso(raw: str | None) -> str | None:
    """Best-effort parse of whatever date shape OCR handed back, to YYYY-MM-DD.
    Returns None rather than guessing when the text doesn't parse as a real date."""
    if not raw:
        return None
    text = raw.strip()
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(text, fmt)
        except ValueError:
            continue
        if fmt.endswith("%y") and dt.year > datetime.now().year + 5:
            dt = dt.replace(year=dt.year - 100)
        return dt.strftime("%Y-%m-%d")
    return None


NORMALIZERS = {
    "phone": normalize_phone_ke,
    "kra_pin": normalize_kra_pin,
    "id_number": normalize_id_number,
    "date": normalize_date_iso,
}


def normalize_fields(fields: dict, field_types: dict[str, str]) -> dict:
    """Given extracted fields and a map of {key: normalizer_name}, returns a parallel
    dict of normalized values (only for keys with a recognised normalizer and a
    non-empty source value) - the raw extracted fields are left untouched."""
    out = {}
    for key, kind in field_types.items():
        fn = NORMALIZERS.get(kind)
        if fn and fields.get(key):
            normalized = fn(str(fields[key]))
            if normalized:
                out[key] = normalized
    return out
