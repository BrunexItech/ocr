from app.models.base import DocumentType


def validate_fields(fields: dict, doc_type: DocumentType | None) -> list[dict]:
    """Generic validation driven entirely by the document type's configurable schema."""
    if not doc_type:
        return []
    errors = []
    for key, spec in (doc_type.fields_schema or {}).items():
        value = fields.get(key)
        if spec.get("required") and (value is None or str(value).strip() == ""):
            errors.append({"field": key, "level": "error", "message": f"{spec.get('label', key)} is required"})
            continue
        if value in (None, "") or spec.get("type") not in ("number", "date"):
            continue
        if spec["type"] == "number":
            try:
                float(str(value).replace(",", ""))
            except ValueError:
                errors.append({"field": key, "level": "error", "message": f"{spec.get('label', key)} must be numeric"})
        elif spec["type"] == "date":
            from app.pipeline.extract_fields import _DATE
            if not _DATE.search(str(value)):
                errors.append({"field": key, "level": "error", "message": f"{spec.get('label', key)} is not a recognisable date"})
    return errors
