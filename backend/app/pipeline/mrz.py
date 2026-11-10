"""MRZ (Machine Readable Zone) parser for passports (TD3) and ID cards (TD1).

Deterministic, open-standard (ICAO 9303) parsing — no ML model or paid API needed.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

_WEIGHTS = [7, 3, 1]
_MRZ_CHARS = "<0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _char_value(c: str) -> int:
    if c == "<":
        return 0
    if c.isdigit():
        return int(c)
    return ord(c) - 55  # A=10 ... Z=35


def _check_digit(data: str) -> int:
    total = sum(_char_value(c) * _WEIGHTS[i % 3] for i, c in enumerate(data))
    return total % 10


def _clean(s: str) -> str:
    return re.sub(r"[^A-Z0-9<]", "", s.upper())


_NATIONALITY_RE = re.compile(r"^[A-Z]{3}$")
_LEADING_DIGITS = re.compile(r"^(\d{1,8})")


@dataclass
class MrzResult:
    doc_type: str
    issuing_country: str
    surname: str
    given_names: str
    document_number: str  # the document/card's own serial number, NOT necessarily the holder's national ID number (they differ on e.g. Kenyan TD1 cards)
    id_number: str  # the holder's actual ID/passport number - see _derive_id_number
    nationality: str
    birth_date: str  # YYMMDD
    sex: str
    expiry_date: str  # YYMMDD
    personal_number: str
    checks: dict  # field -> bool (checksum valid)
    valid: bool


def _clean_nationality(raw: str) -> str:
    """Only keep it if it's actually a plausible ISO-3166 alpha-3 code - some real
    TD1 cards (observed on a real Kenyan ID) don't populate this slot the way the
    spec describes, and a garbage 3-char fragment is worse than admitting we don't
    have it."""
    return raw if _NATIONALITY_RE.match(raw) else ""


def _derive_id_number(document_number: str, optional_data_2: str) -> str:
    """On a real Kenyan TD1 ID card, MRZ line 1's "document number" field actually
    holds the card's serial number - a different thing from the printed "ID NUMBER"
    citizens actually use. The real ID number is embedded in line 2's second
    optional-data field instead: an 7-8 digit ID number, immediately followed by a
    single numeric check digit, then "<" padding. _LEADING_DIGITS is capped at 8
    digits specifically so that check digit is never swallowed into the result -
    matching on "however many leading digits happen to appear" would always grab
    one digit too many here, every single time, since the check digit is itself a
    plain digit with nothing to visually separate it from the real ID number.
    Prefer the capped match when it looks like a real number; otherwise fall back
    to document_number (right for a passport, where there's no such split)."""
    m = _LEADING_DIGITS.match(optional_data_2)
    if m and len(m.group(1)) >= 6:
        return m.group(1)
    return document_number


def _fmt_date(yymmdd: str) -> str:
    if len(yymmdd) != 6 or not yymmdd.isdigit():
        return yymmdd
    yy, mm, dd = yymmdd[:2], yymmdd[2:4], yymmdd[4:6]
    century = "19" if int(yy) > 50 else "20"
    return f"{century}{yy}-{mm}-{dd}"


def parse_td3(line1: str, line2: str) -> MrzResult:
    """TD3: passports. Two lines of 44 chars."""
    l1, l2 = _clean(line1).ljust(44, "<")[:44], _clean(line2).ljust(44, "<")[:44]
    doc_type = l1[0:2].rstrip("<")
    issuing_country = l1[2:5]
    names = l1[5:44].split("<<", 1)
    surname = names[0].replace("<", " ").strip()
    given_names = names[1].replace("<", " ").strip() if len(names) > 1 else ""

    doc_number, doc_check = l2[0:9], l2[9]
    nationality = l2[10:13]
    birth_date, birth_check = l2[13:19], l2[19]
    sex = l2[20]
    expiry_date, expiry_check = l2[21:27], l2[27]
    personal_number, personal_check = l2[28:42], l2[42]
    composite_check = l2[43]

    checks = {
        "document_number": str(_check_digit(doc_number)) == doc_check,
        "birth_date": str(_check_digit(birth_date)) == birth_check,
        "expiry_date": str(_check_digit(expiry_date)) == expiry_check,
        "personal_number": personal_number.strip("<") == "" or str(_check_digit(personal_number)) == personal_check,
    }
    composite = doc_number + doc_check + birth_date + birth_check + expiry_date + expiry_check + personal_number + personal_check
    checks["composite"] = str(_check_digit(composite)) == composite_check

    doc_number_clean = doc_number.rstrip("<")
    return MrzResult(
        doc_type=doc_type, issuing_country=issuing_country, surname=surname, given_names=given_names,
        document_number=doc_number_clean, id_number=doc_number_clean,  # passport number IS the id number, no split
        nationality=_clean_nationality(nationality),
        birth_date=_fmt_date(birth_date), sex=sex, expiry_date=_fmt_date(expiry_date),
        personal_number=personal_number.rstrip("<"), checks=checks,
        valid=all(checks.values()),
    )


def parse_td1(line1: str, line2: str, line3: str) -> MrzResult:
    """TD1: national ID cards. Three lines of 30 chars."""
    l1 = _clean(line1).ljust(30, "<")[:30]
    l2 = _clean(line2).ljust(30, "<")[:30]
    l3 = _clean(line3).ljust(30, "<")[:30]

    doc_type = l1[0:2].rstrip("<")
    issuing_country = l1[2:5]
    doc_number, doc_check = l1[5:14], l1[14]
    personal_number = l1[15:30]

    birth_date, birth_check = l2[0:6], l2[6]
    sex = l2[7]
    expiry_date, expiry_check = l2[8:14], l2[14]
    nationality = l2[15:18]
    optional_data_2 = l2[18:29]
    composite_check = l2[29]

    names = l3.split("<<", 1)
    surname = names[0].replace("<", " ").strip()
    given_names = names[1].replace("<", " ").strip() if len(names) > 1 else ""

    checks = {
        "document_number": str(_check_digit(doc_number)) == doc_check,
        "birth_date": str(_check_digit(birth_date)) == birth_check,
        "expiry_date": str(_check_digit(expiry_date)) == expiry_check,
    }
    composite = doc_number + doc_check + birth_date + birth_check + expiry_date + expiry_check + personal_number
    checks["composite"] = str(_check_digit(composite)) == composite_check

    doc_number_clean = doc_number.rstrip("<")
    return MrzResult(
        doc_type=doc_type, issuing_country=issuing_country, surname=surname, given_names=given_names,
        document_number=doc_number_clean, id_number=_derive_id_number(doc_number_clean, optional_data_2),
        nationality=_clean_nationality(nationality),
        birth_date=_fmt_date(birth_date), sex=sex, expiry_date=_fmt_date(expiry_date),
        personal_number=personal_number.rstrip("<"), checks=checks,
        valid=all(checks.values()),
    )


def find_and_parse_mrz(full_text: str) -> MrzResult | None:
    """Scan OCR'd text for MRZ-like lines and parse the best candidate."""
    candidates = [_clean(l) for l in full_text.splitlines() if l.strip()]
    mrz_lines = [l for l in candidates if len(l) >= 28 and l.count("<") >= 2]
    if len(mrz_lines) >= 3:
        for i in range(len(mrz_lines) - 2):
            l1, l2, l3 = mrz_lines[i], mrz_lines[i + 1], mrz_lines[i + 2]
            if len(l1) >= 28 and len(l2) >= 28 and len(l3) >= 28:
                try:
                    return parse_td1(l1[:30], l2[:30], l3[:30])
                except Exception:
                    continue
    if len(mrz_lines) >= 2:
        for i in range(len(mrz_lines) - 1):
            l1, l2 = mrz_lines[i], mrz_lines[i + 1]
            if len(l1) >= 40 and len(l2) >= 40:
                try:
                    return parse_td3(l1[:44], l2[:44])
                except Exception:
                    continue
    return None


# ISO 3166-1 alpha-3 -> common name, for the countries this is actually likely to see
# in practice. Deliberately not exhaustive - an unrecognised code is left as-is rather
# than guessed, so this can only ever improve on showing the raw code, never show
# something wrong.
COUNTRY_NAMES = {
    "KEN": "Kenya", "UGA": "Uganda", "TZA": "Tanzania", "RWA": "Rwanda", "BDI": "Burundi",
    "ETH": "Ethiopia", "SOM": "Somalia", "SSD": "South Sudan", "SDN": "Sudan", "ZMB": "Zambia",
    "MWI": "Malawi", "MOZ": "Mozambique", "ZAF": "South Africa", "NGA": "Nigeria", "GHA": "Ghana",
    "USA": "United States", "GBR": "United Kingdom", "CAN": "Canada", "IND": "India", "CHN": "China",
}

# Matches the printed header most national IDs/passports carry ("REPUBLIC OF KENYA",
# "JAMHURI YA KENYA", etc.) - used only as a fallback when the MRZ's own nationality
# strip couldn't be read cleanly, since the country name is usually printed in plain,
# much larger text elsewhere on the same page and is far less likely to be misread.
_COUNTRY_HEADER_RE = re.compile(r"\b(?:REPUBLIC OF|JAMHURI YA|UNITED REPUBLIC OF)\s+([A-Z]+)\b", re.I)


def _detect_country_from_text(text: str) -> str:
    m = _COUNTRY_HEADER_RE.search(text or "")
    return m.group(1).title() if m else ""


def mrz_to_fields(result: MrzResult) -> dict:
    """Key names here match extract_id_fields' (the no-MRZ fallback) exactly - so
    the UI shows the same field names ("ID Number", "Date Of Birth", ...) and a
    reviewer correcting a value isn't faced with a different vocabulary depending on
    which path happened to read the card."""
    full_name = f"{result.given_names} {result.surname}".strip() if result.given_names else result.surname
    return {
        "document_type": "Passport" if result.doc_type.startswith("P") else "ID card",
        "issuing_country": result.issuing_country,
        "full_name": full_name,
        "id_number": result.id_number,
        "document_number": result.document_number,  # the card's own serial number - kept distinct from id_number since they can differ (e.g. Kenyan TD1)
        "nationality": result.nationality,
        "date_of_birth": result.birth_date,
        "sex": result.sex,
        "date_of_expiry": result.expiry_date,
        "mrz_checksum_valid": result.valid,
    }
