from app.core.masking import mask_fields
from app.models.base import Role


class FakeType:
    fields_schema = {"salary": {"sensitive": True}, "name": {"sensitive": False}}


FIELDS = {"salary": "50000", "name": "Jane"}


def test_viewer_cannot_see_sensitive_field():
    out = mask_fields(FIELDS, FakeType(), Role.viewer, reveal=False)
    assert out["salary"] == "••••••••"
    assert out["name"] == "Jane"


def test_admin_without_explicit_reveal_still_masked():
    out = mask_fields(FIELDS, FakeType(), Role.admin, reveal=False)
    assert out["salary"] == "••••••••"


def test_admin_with_reveal_sees_sensitive_field():
    out = mask_fields(FIELDS, FakeType(), Role.admin, reveal=True)
    assert out["salary"] == "50000"


def test_reviewer_cannot_force_reveal():
    out = mask_fields(FIELDS, FakeType(), Role.reviewer, reveal=True)
    assert out["salary"] == "••••••••"


def test_no_document_type_masks_nothing():
    out = mask_fields(FIELDS, None, Role.viewer, reveal=False)
    assert out == FIELDS
