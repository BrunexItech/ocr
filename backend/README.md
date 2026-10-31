# Oqtekal OCR — backend

Open-source, self-hosted OCR platform: scan → extract → review → approve → push to a database.
No paid APIs anywhere in the pipeline.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
# CPU-only torch first — skips ~650MB of unneeded CUDA/GPU wheels that
# easyocr's default dependency would otherwise pull in:
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

First run creates `oqtekal.db` (SQLite) and all tables automatically.

Seed starter document-type templates (invoice, ID/passport, student record,
patient record, KYC form, athlete registration — covering the "works anywhere"
verticals out of the box; admins can add/edit types for any other domain):

```bash
python -m scripts.seed_templates
```

## First admin account

The first user to call `POST /api/auth/register` becomes `admin` automatically.
Every account after that defaults to `viewer` until an admin changes its role
via `PATCH /api/admin/users/{id}`.

## Roles

- `admin` — manages users, document types, integrations; can approve
- `approver` — final sign-off, locks records, assigns retention, reveals masked fields
- `reviewer` — corrects OCR output and metadata, submits for approval
- `intake` — registers and uploads scans
- `viewer` — read-only, sees masked sensitive fields

## Core workflow

1. `POST /api/documents/intake` (role: intake/admin) — upload a scan, OCR runs immediately,
   routes to `awaiting_review` (low confidence / validation errors) or `awaiting_approval`.
2. `PATCH /api/documents/{id}/fields` (reviewer/approver/admin) — correct extracted fields;
   every change is versioned.
3. `POST /api/documents/{id}/submit` (reviewer/admin) — move to approval queue.
4. `POST /api/documents/{id}/approve` (approver/admin) — locks the record permanently.
5. `POST /api/documents/{id}/push` (approver/admin) — send selected fields from an
   **approved** record to a configured downstream integration (webhook today;
   extend `Integration.kind` for direct DB writes).

## Audit & compliance

Every action is written to a SHA-256 hash-chained `AuditEvent` log
(`POST /api/audit/verify` re-hashes the whole chain and reports any tampering).
Fields marked `"sensitive": true` in a document type's schema are masked for
everyone except `admin`/`approver` roles, and only when they explicitly pass
`?reveal=true` (itself logged).

## Document types are fully configurable

Nothing about "invoice" or "ID card" is hardcoded in the pipeline — an admin
defines each document type's field schema, which fields are required,
which are sensitive, and the default retention period. This is what makes
the same OCR core usable for a school, a hospital, a fintech KYC desk or a
sports federation without touching code.

## Tests

```bash
python -I -m pytest tests/ -q
```

Covers: field extraction regexes, MRZ (ICAO 9303) parsing + checksum tamper
detection, and a full end-to-end workflow test (RBAC, intake, correction,
segregation-of-duties on approval, locking, push, audit-chain integrity).
The end-to-end test stubs the OCR engine so it runs fast and deterministically
regardless of which ML backend (EasyOCR by default) is installed.
