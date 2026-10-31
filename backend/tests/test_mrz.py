from app.pipeline.mrz import find_and_parse_mrz, mrz_to_fields, parse_td3


def test_parse_td3_valid_passport():
    # Standard ICAO 9303 worked example (Anna Maria Eriksson)
    line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<"
    line2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
    r = parse_td3(line1, line2)
    assert r.surname == "ERIKSSON"
    assert r.given_names == "ANNA MARIA"
    assert r.document_number == "L898902C3"
    assert r.nationality == "UTO"
    assert r.sex == "F"
    assert r.valid is True


def test_tampered_document_number_fails_checksum():
    line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<"
    line2 = "L898902C99UTO7408122F1204159ZE184226B<<<<<10"
    r = parse_td3(line1, line2)
    assert r.checks["document_number"] is False
    assert r.valid is False


def test_find_and_parse_mrz_from_noisy_text():
    text = "REPUBLIC OF UTOPIA\nPASSPORT\nP<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10\n"
    r = find_and_parse_mrz(text)
    assert r is not None
    fields = mrz_to_fields(r)
    assert fields["document_number"] == "L898902C3"
    assert fields["document_type"] == "Passport"
    assert fields["mrz_checksum_valid"] is True
