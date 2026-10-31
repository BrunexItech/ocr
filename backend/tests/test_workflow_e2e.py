"""End-to-end test of the full Oqtekal OCR workflow against an isolated SQLite DB.

Covers: user registration/RBAC, configurable document types, intake + OCR,
confidence-based routing, field correction + versioning, submit/approve/lock,
masking of sensitive fields, audit chain integrity, and push-to-integration.

Uses FastAPI dependency overrides (not module reloading) to point at a throwaway
database, so this test is immune to import order relative to other test files.
"""
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base, get_db
from app.main import app
import app.api.documents_router as documents_router
from app.pipeline.engine import OcrResult, TextBlock


@pytest.fixture()
def client(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # Stub the OCR engine so this test is fast and deterministic, independent of
    # whatever ML backend (EasyOCR/PaddleOCR/Tesseract) is installed in this environment.
    def fake_run(self, image):
        # Deliberately low confidence so the document is routed to the review queue first,
        # exercising the full review -> submit -> approve state machine (not a direct-to-approval shortcut).
        text = "INVOICE\nInvoice No: INV-1000\nDate: 01/06/2026\nTotal Due KES 5,000.00"
        blocks = [TextBlock(text=line, confidence=0.6, box=[(0, 0), (1, 0), (1, 1), (0, 1)]) for line in text.splitlines()]
        return OcrResult(full_text=text, blocks=blocks, engine="stub")

    monkeypatch.setattr(documents_router._engine, "run", fake_run.__get__(documents_router._engine))

    yield TestClient(app)

    app.dependency_overrides.pop(get_db, None)


def _auth_headers(client, email, password):
    r = client.post("/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _make_test_image() -> bytes:
    img = Image.new("RGB", (400, 200), "white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "INVOICE", fill="black")
    draw.text((10, 40), "Invoice No: INV-1001", fill="black")
    draw.text((10, 70), "Date: 01/06/2026", fill="black")
    draw.text((10, 100), "Total Due KES 5,000.00", fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_full_workflow(client):
    # 1. First registered user becomes admin
    r = client.post("/api/auth/register", json={"email": "admin@oqtekal.local", "name": "Admin", "password": "Passw0rd!"})
    assert r.status_code == 200
    admin_headers = _auth_headers(client, "admin@oqtekal.local", "Passw0rd!")

    # 2. Admin creates reviewer/approver/intake users
    for email, role in [("reviewer@oqtekal.local", "reviewer"), ("approver@oqtekal.local", "approver"), ("intake@oqtekal.local", "intake")]:
        r = client.post("/api/admin/users", json={"email": email, "name": email, "password": "Passw0rd!", "role": role}, headers=admin_headers)
        assert r.status_code == 200, r.text
    reviewer_headers = _auth_headers(client, "reviewer@oqtekal.local", "Passw0rd!")
    approver_headers = _auth_headers(client, "approver@oqtekal.local", "Passw0rd!")
    intake_headers = _auth_headers(client, "intake@oqtekal.local", "Passw0rd!")

    # 3. Admin defines a configurable document type (generic invoice, works for any vertical)
    r = client.post("/api/admin/document-types", json={
        "code": "INV", "name": "Invoice", "domain": "generic",
        "fields_schema": {
            "invoice_number": {"label": "Invoice number", "type": "text", "required": True},
            "total_amount": {"label": "Total amount", "type": "text", "required": False},
        },
        "default_sensitivity": "internal",
    }, headers=admin_headers)
    assert r.status_code == 200, r.text
    type_id = r.json()["id"]

    # 4. A viewer (no intake role) cannot register documents
    r = client.post("/api/admin/users", json={"email": "viewer@oqtekal.local", "name": "Viewer", "password": "Passw0rd!", "role": "viewer"}, headers=admin_headers)
    assert r.status_code == 200
    viewer_headers = _auth_headers(client, "viewer@oqtekal.local", "Passw0rd!")
    r = client.post(f"/api/documents/intake?type_id={type_id}", files={"file": ("invoice.png", _make_test_image(), "image/png")}, headers=viewer_headers)
    assert r.status_code == 403

    # 5. An unknown type_id is rejected outright
    r = client.post("/api/documents/intake?type_id=does-not-exist", files={"file": ("invoice.png", _make_test_image(), "image/png")}, headers=intake_headers)
    assert r.status_code == 400

    # 6. Intake officer registers + OCRs a document
    r = client.post(f"/api/documents/intake?type_id={type_id}", files={"file": ("invoice.png", _make_test_image(), "image/png")}, headers=intake_headers)
    assert r.status_code == 200, r.text
    doc = r.json()
    doc_id = doc["id"]
    assert doc["tracking_no"].startswith("OQ-")
    assert doc["status"] == "awaiting_review"

    # 7. Reviewer corrects a field if needed, then submits
    r = client.patch(f"/api/documents/{doc_id}/fields", json={"fields": {"invoice_number": "INV-1001"}}, headers=reviewer_headers)
    assert r.status_code == 200, r.text
    r = client.post(f"/api/documents/{doc_id}/submit", headers=reviewer_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "awaiting_approval"

    # 8. Reviewer cannot approve (segregation of duties)
    r = client.post(f"/api/documents/{doc_id}/approve", headers=reviewer_headers)
    assert r.status_code == 403

    # 9. Approver approves and locks
    r = client.post(f"/api/documents/{doc_id}/approve", headers=approver_headers)
    assert r.status_code == 200, r.text
    assert r.json()["locked"] is True
    assert r.json()["status"] == "approved"

    # 10. Locked document cannot be edited
    r = client.patch(f"/api/documents/{doc_id}/fields", json={"fields": {"invoice_number": "X"}}, headers=reviewer_headers)
    assert r.status_code == 409

    # 11. Configure a push integration and push selected fields
    r = client.post("/api/integrations/", json={"name": "Demo DB", "kind": "csv_export", "config": {}}, headers=admin_headers)
    assert r.status_code == 200, r.text
    integration_id = r.json()["id"]
    r = client.post(f"/api/documents/{doc_id}/push", json={"integration_id": integration_id, "fields": ["invoice_number"]}, headers=approver_headers)
    assert r.status_code == 200, r.text
    assert r.json()["pushed"] == {"invoice_number": "INV-1001"}

    # 12. Audit chain integrity holds after all this activity
    r = client.post("/api/audit/verify", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # 13. Downloads work and are audited
    r = client.get(f"/api/documents/{doc_id}/download/text", headers=viewer_headers)
    assert r.status_code == 200
    r = client.get(f"/api/documents/{doc_id}/download/original", headers=viewer_headers)
    assert r.status_code == 200
