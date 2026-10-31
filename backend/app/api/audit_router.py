from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.core.audit import verify_chain
from app.db.session import get_db
from app.models.base import AuditEvent, Role, User

router = APIRouter()


@router.get("/")
def list_events(limit: int = 200, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin, Role.approver))):
    events = db.query(AuditEvent).order_by(AuditEvent.seq.desc()).limit(limit).all()
    return [{"seq": e.seq, "ts": e.ts, "user": e.user, "role": e.role, "action": e.action,
             "document_id": e.document_id, "detail": e.detail, "hash": e.hash} for e in events]


@router.post("/verify")
def verify(db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    return verify_chain(db)
