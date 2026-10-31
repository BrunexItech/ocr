# Oqtekal OCR

Open-source, self-hosted OCR platform: scan → extract → review → approve → push to a database.
No paid APIs anywhere in the pipeline — built to be used across domains (schools, hospitals,
fintech KYC, sports federations, or any paper-to-database migration) via a single configurable
document-type schema rather than hardcoded document logic.

## Structure

```
ocr/
├── backend/   FastAPI REST API — auth/RBAC, OCR pipeline, workflow, audit, integrations
└── frontend/  Next.js UI — intake, review/approve queue, admin, audit trail
```

Each is independently deployable. The backend is a plain REST + JWT API with permissive CORS,
so any other product (web, mobile, another backend) can call it directly, or receive pushed
records via a configured webhook integration — this frontend is one consumer of that API, not
a requirement for using it.

See `backend/README.md` for API/setup details.

## Quick start

```bash
# backend
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m scripts.seed_templates   # starter document types
uvicorn app.main:app --reload --port 8000

# frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Open http://localhost:3000, register the first account (becomes admin automatically), and
create an `intake` user to start scanning.

## Architecture notes

- **Modular by concern**: `app/pipeline` (OCR/preprocessing/extraction, swappable engine),
  `app/models` (schema), `app/api` (routers per resource), `app/auth` (JWT/RBAC), `app/core`
  (config, audit, masking, validation) — each independent and unit-testable.
- **Pluggable OCR engine**: `app/pipeline/engine.py` defines an `OcrEngine` protocol; EasyOCR
  is the default (pip-only, no system dependency), PaddleOCR is available as a drop-in
  alternative for higher table/layout accuracy if installed.
- **No hardcoded document types**: an admin defines each type's fields, which are required,
  which are sensitive, and retention — the same pipeline then works for an invoice, an ID card,
  or any domain-specific form.
- **Security by default**: hash-chained tamper-evident audit log, role-based access control,
  sensitive-field masking, segregation of duties (reviewers can't approve their own corrections).
