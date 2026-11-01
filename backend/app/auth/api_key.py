import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.base import ServiceAccount

EMBED_SCOPE = "embed_scan"
EMBED_TOKEN_MINUTES = 15


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


def create_embed_token(account_id: str) -> tuple[str, int]:
    """Short-lived (15 min), narrowly-scoped token a parent page exchanges its own
    long-lived API key for, so the key itself never has to sit in an iframe URL or
    browser-visible JS - only this token does, and it can't do anything but scan."""
    expire = datetime.utcnow() + timedelta(minutes=EMBED_TOKEN_MINUTES)
    payload = {"sub": account_id, "scope": EMBED_SCOPE, "exp": expire}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, EMBED_TOKEN_MINUTES * 60


def get_embed_account(
    x_embed_token: str = Header(..., alias="X-Embed-Token"),
    db: Session = Depends(get_db),
) -> ServiceAccount:
    try:
        payload = jwt.decode(x_embed_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired embed token")
    if payload.get("scope") != EMBED_SCOPE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not an embed token")
    account = db.get(ServiceAccount, payload["sub"])
    if not account or not account.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Service account not found or inactive")
    return account
