from app.api.documents_router import _detect_kind


def test_detects_identity_document_from_mrz_fields():
    assert _detect_kind({"mrz_checksum_valid": True, "surname": "DOE"}) == "ID card / Passport"


def test_detects_invoice_from_invoice_number():
    assert _detect_kind({"invoice_number": "INV-1"}) == "Invoice / Receipt"


def test_detects_invoice_from_total_amount_alone():
    assert _detect_kind({"total_amount": "100.00"}) == "Invoice / Receipt"


def test_falls_back_to_generic_document():
    assert _detect_kind({"line_count": 3}) == "Document"
