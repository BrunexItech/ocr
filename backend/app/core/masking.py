from app.models.base import REVEAL_ROLES, DocumentType, Role


def mask_fields(fields: dict, doc_type: DocumentType | None, role: Role, reveal: bool = False) -> dict:
    """Hide fields marked 'sensitive' in the document type's schema unless the viewer may reveal them."""
    if role in REVEAL_ROLES and reveal:
        return fields
    schema = (doc_type.fields_schema if doc_type else {}) or {}
    out = {}
    for k, v in fields.items():
        spec = schema.get(k, {})
        out[k] = "••••••••" if spec.get("sensitive") else v
    return out
