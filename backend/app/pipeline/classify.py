"""Shared document-kind classification + field extraction, used by both the normal
intake flow and the embed-scan endpoint, so the two can never silently diverge."""
from __future__ import annotations

from app.models.base import DocumentType
from app.pipeline.extract_fields import (
    extract_fields_by_schema,
    extract_generic_fields,
    extract_id_fields,
    extract_invoice_fields,
    looks_like_id,
)
from app.pipeline.mrz import COUNTRY_NAMES, MrzResult, find_and_parse_mrz, mrz_to_fields, _detect_country_from_text


def classify_and_extract(
    full_text: str,
    front_text: str,
    back_text: str,
    kind: str | None,
    doc_type: DocumentType | None,
    overall_conf: float,
) -> tuple[dict, MrzResult | None, float]:
    """Returns (extracted_fields, mrz_result_or_None, possibly-adjusted overall_conf)."""
    looks_identity = kind in ("id_card", "passport") or (doc_type and doc_type.domain == "identity")
    treat_as_identity = looks_identity or (kind is None and not doc_type and looks_like_id(full_text))

    mrz_result = find_and_parse_mrz(full_text) if (treat_as_identity or not doc_type) else None
    if mrz_result:
        extracted = mrz_to_fields(mrz_result)
        if not extracted.get("nationality"):
            # The MRZ's own nationality strip didn't read as a clean 3-letter code -
            # most national IDs/passports also print the issuing country in plain,
            # much larger text elsewhere on the page ("REPUBLIC OF KENYA"), which is
            # far less likely to be misread than three tiny MRZ characters. Use that
            # instead of leaving a field blank that the document actually does show.
            extracted["nationality"] = _detect_country_from_text(full_text)
        if extracted.get("issuing_country") and extracted["issuing_country"] not in COUNTRY_NAMES:
            # Same idea for issuing_country: some real cards print a 3-letter code in
            # that MRZ slot that isn't a valid ICAO country code at all (not OCR noise
            # on our end - verified against the actual printed card), so there's no
            # code to map to a name. Fall back to the plain-text header instead of
            # showing an unrecognisable 3-letter string with no way to know what it
            # means.
            header_name = _detect_country_from_text(full_text)
            if header_name:
                extracted["issuing_country"] = header_name
        if not mrz_result.valid:
            overall_conf = min(overall_conf, 0.5)
    elif treat_as_identity:
        extracted = extract_id_fields(front_text)
        if back_text:
            for k, v in extract_id_fields(back_text).items():
                if not extracted.get(k) and v:
                    extracted[k] = v
    elif doc_type and doc_type.fields_schema:
        extracted = extract_fields_by_schema(full_text, doc_type.fields_schema)
        invoice_guess = extract_invoice_fields(full_text)
        for k in extracted:
            if not extracted[k] and k in invoice_guess and invoice_guess[k]:
                extracted[k] = invoice_guess[k]
    else:
        extracted = extract_invoice_fields(full_text)
        for k, v in extract_generic_fields(full_text).items():
            extracted.setdefault(k, v)

    return extracted, mrz_result, overall_conf
