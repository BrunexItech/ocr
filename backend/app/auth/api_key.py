import hashlib
import secrets
from datetime import datetime

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.base import ServiceAccount


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, key_hash, key_prefix). The raw key is shown to the admin
    exactly once at creation time and never stored - only its hash is kept."""
    raw = "oqk_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, key_hash, raw[:10]


def get_service_account(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> ServiceAccount:
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    account = db.query(ServiceAccount).filter(ServiceAccount.key_hash == key_hash).first()
    if not account or not account.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or inactive API key")
    account.last_used_at = datetime.utcnow()
    db.commit()
    return account
