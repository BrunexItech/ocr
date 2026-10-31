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


@dataclass
class MrzResult:
    doc_type: str
    issuing_country: str
    surname: str
    given_names: str
    document_number: str
    nationality: str
    birth_date: str  # YYMMDD
    sex: str
    expiry_date: str  # YYMMDD
    personal_number: str
    checks: dict  # field -> bool (checksum valid)
    valid: bool


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

    return MrzResult(
        doc_type=doc_type, issuing_country=issuing_country, surname=surname, given_names=given_names,
        document_number=doc_number.rstrip("<"), nationality=nationality,
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

    return MrzResult(
        doc_type=doc_type, issuing_country=issuing_country, surname=surname, given_names=given_names,
        document_number=doc_number.rstrip("<"), nationality=nationality,
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


def mrz_to_fields(result: MrzResult) -> dict:
    return {
        "document_type": "Passport" if result.doc_type.startswith("P") else "ID card",
        "issuing_country": result.issuing_country,
        "surname": result.surname,
        "given_names": result.given_names,
        "document_number": result.document_number,
        "nationality": result.nationality,
        "birth_date": result.birth_date,
        "sex": result.sex,
        "expiry_date": result.expiry_date,
        "personal_number": result.personal_number,
        "mrz_checksum_valid": result.valid,
    }
