from app.pipeline.extract_fields import extract_invoice_fields


def test_extracts_total_and_date():
    text = "Acme Supplies\nInvoice No: INV-2041\nDate: 12/03/2026\nSubtotal 1,200.00\nTotal Due KES 1,380.00"
    fields = extract_invoice_fields(text)
    assert fields["invoice_number"] == "INV-2041"
    assert "12/03/2026" in fields["dates_found"]
    assert fields["total_amount"] == "1,380.00"


def test_handles_empty_text():
    fields = extract_invoice_fields("")
    assert fields["total_amount"] is None
    assert fields["dates_found"] == []
    assert fields["line_count"] == 0


def test_tolerates_ocr_word_segmentation_spacing():
    # EasyOCR frequently splits tight punctuation into separate words with spaces
    # (e.g. "05 /10 /2026", "12,345 . 00") - extraction must still find them.
    text = "IIVOICE\nInvoice\nINV-9001\nDate\n05 /10 /2026\nTotal Due\n12,345 . 00"
    fields = extract_invoice_fields(text)
    assert fields["invoice_number"] == "INV-9001"
    assert fields["date"] == "05/10/2026"
    assert fields["total_amount"] == "12,345.00"


def test_falls_back_to_last_amount_when_total_label_is_garbled():
    # "Total" misread as "Tota" (missing final letter) must not lose the amount entirely.
    text = "Receipt\nSubtotal 500.00\nTota 650.00"
    fields = extract_invoice_fields(text)
    assert fields["total_amount"] == "650.00"
