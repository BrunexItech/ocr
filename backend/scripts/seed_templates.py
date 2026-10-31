"""Seed starter document-type templates for common verticals.

Run with: python -m scripts.seed_templates
Demonstrates that Oqtekal OCR's schema is admin-configurable, not hardcoded.
"""
from app.db.session import Base, SessionLocal, engine
from app.models.base import DocumentType

Base.metadata.create_all(bind=engine)

TEMPLATES = [
    dict(code="INVOICE", name="Invoice / receipt", domain="generic", default_sensitivity="internal",
         fields_schema={
             "invoice_number": {"label": "Invoice number", "type": "text", "required": True},
             "date": {"label": "Date", "type": "date", "required": True},
             "total_amount": {"label": "Total amount", "type": "number", "required": True},
         }),
    dict(code="ID_CARD", name="National ID / Passport", domain="identity", default_sensitivity="sensitive", retention_days=3650,
         fields_schema={
             "document_number": {"label": "Document number", "type": "text", "required": True, "sensitive": True},
             "surname": {"label": "Surname", "type": "text", "required": True},
             "given_names": {"label": "Given names", "type": "text", "required": True},
             "birth_date": {"label": "Date of birth", "type": "date", "required": True, "sensitive": True},
             "expiry_date": {"label": "Expiry date", "type": "date", "required": False},
         }),
    dict(code="STUDENT_RECORD", name="Student enrollment record", domain="school", default_sensitivity="internal",
         fields_schema={
             "student_name": {"label": "Student name", "type": "text", "required": True},
             "admission_no": {"label": "Admission number", "type": "text", "required": True},
             "date_of_birth": {"label": "Date of birth", "type": "date", "required": False, "sensitive": True},
             "guardian_name": {"label": "Guardian name", "type": "text", "required": False},
         }),
    dict(code="PATIENT_RECORD", name="Patient intake form", domain="hospital", default_sensitivity="sensitive", retention_days=3650,
         fields_schema={
             "patient_name": {"label": "Patient name", "type": "text", "required": True, "sensitive": True},
             "patient_id": {"label": "Patient ID", "type": "text", "required": True},
             "diagnosis": {"label": "Diagnosis / notes", "type": "text", "required": False, "sensitive": True},
             "date_of_visit": {"label": "Date of visit", "type": "date", "required": True},
         }),
    dict(code="KYC_FORM", name="KYC / account opening form", domain="fintech", default_sensitivity="sensitive", retention_days=2555,
         fields_schema={
             "full_name": {"label": "Full name", "type": "text", "required": True, "sensitive": True},
             "id_number": {"label": "ID number", "type": "text", "required": True, "sensitive": True},
             "account_number": {"label": "Account number", "type": "text", "required": False, "sensitive": True},
             "date_opened": {"label": "Date opened", "type": "date", "required": True},
         }),
    dict(code="ATHLETE_REG", name="Athlete / club registration", domain="sports", default_sensitivity="internal",
         fields_schema={
             "athlete_name": {"label": "Athlete name", "type": "text", "required": True},
             "licence_no": {"label": "Licence number", "type": "text", "required": True},
             "club": {"label": "Club / federation", "type": "text", "required": False},
         }),
]


def run():
    db = SessionLocal()
    try:
        for t in TEMPLATES:
            if db.query(DocumentType).filter(DocumentType.code == t["code"]).first():
                continue
            db.add(DocumentType(**t))
        db.commit()
        print(f"Seeded {len(TEMPLATES)} document-type templates.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
