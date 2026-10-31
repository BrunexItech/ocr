from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.core.audit import record
from app.db.session import get_db
from app.models.base import Integration, Role, User

router = APIRouter()


class IntegrationIn(BaseModel):
    name: str
    kind: str  # webhook | csv_export
    config: dict = {}


class IntegrationOut(IntegrationIn):
    id: str
    active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=list[IntegrationOut])
def list_integrations(db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    return db.query(Integration).all()


@router.post("/", response_model=IntegrationOut)
def create_integration(body: IntegrationIn, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    integ = Integration(**body.model_dump())
    db.add(integ)
    db.flush()
    record(db, user=user.name, role=user.role, action="admin.integration_create", detail=integ.name)
    db.commit()
    return integ


@router.delete("/{integration_id}")
def deactivate_integration(integration_id: str, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    integ = db.get(Integration, integration_id)
    if not integ:
        raise HTTPException(404, "Integration not found")
    integ.active = False
    record(db, user=user.name, role=user.role, action="admin.integration_disable", detail=integ.name)
    db.commit()
    return {"ok": True}
