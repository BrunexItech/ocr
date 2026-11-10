from app.models.base import REVEAL_ROLES, DocumentType, Role

# Auto-detected ID/passport scans (MRZ or label-based) never go through an
# admin-configured document type, so they have no fields_schema to mark anything
# "sensitive" in - without this, the reveal toggle had nothing to ever hide on the
# single most sensitive document type the app handles. These are masked by default
# the same way a custom type's "sensitive" fields are, even with no doc_type at all.
_BUILTIN_SENSITIVE_FIELDS = {"id_number", "document_number", "personal_number"}


def mask_fields(fields: dict, doc_type: DocumentType | None, role: Role, reveal: bool = False) -> dict:
    """Hide fields marked 'sensitive' in the document type's schema (or, with no
    document type, the built-in sensitive fields for auto-detected ID scans) unless
    the viewer may reveal them."""
    if role in REVEAL_ROLES and reveal:
        return fields
    schema = (doc_type.fields_schema if doc_type else {}) or {}
    out = {}
    for k, v in fields.items():
        spec = schema.get(k, {})
        sensitive = spec.get("sensitive") or (not doc_type and k in _BUILTIN_SENSITIVE_FIELDS)
        out[k] = "••••••••" if sensitive else v
    return out
