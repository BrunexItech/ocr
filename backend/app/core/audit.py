import hashlib

from sqlalchemy.orm import Session

from app.models.base import AuditEvent

GENESIS_HASH = "0" * 64


def _canon(e: AuditEvent) -> str:
    return "|".join([str(e.seq), e.ts.isoformat(), e.user, e.role, e.action, e.document_id or "", e.detail])


def record(db: Session, *, user: str, role: str, action: str, document_id: str | None = None, detail: str = "") -> AuditEvent:
    last = db.query(AuditEvent).order_by(AuditEvent.seq.desc()).first()
    prev_hash = last.hash if last else GENESIS_HASH
    event = AuditEvent(user=user, role=role, action=action, document_id=document_id, detail=detail, prev_hash=prev_hash, hash="")
    db.add(event)
    db.flush()  # assigns seq, ts
    event.hash = hashlib.sha256((prev_hash + "|" + _canon(event)).encode()).hexdigest()
    db.flush()
    return event


def verify_chain(db: Session) -> dict:
    events = db.query(AuditEvent).order_by(AuditEvent.seq).all()
    prev = GENESIS_HASH
    for e in events:
        if e.prev_hash != prev:
            return {"ok": False, "at": e.seq, "reason": "broken link: previous-hash mismatch"}
        expected = hashlib.sha256((prev + "|" + _canon(e)).encode()).hexdigest()
        if expected != e.hash:
            return {"ok": False, "at": e.seq, "reason": "event content altered: hash mismatch"}
        prev = e.hash
    return {"ok": True, "count": len(events), "head": prev}
