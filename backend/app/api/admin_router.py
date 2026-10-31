from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_roles
from app.auth.security import hash_password
from app.core.audit import record
from app.db.session import get_db
from app.models.base import DocumentType, Role, User

router = APIRouter()


class DocTypeIn(BaseModel):
    code: str
    name: str
    domain: str = "generic"
    fields_schema: dict = {}  # {"amount": {"label": "Amount", "type": "number", "required": True, "sensitive": False}}
    default_sensitivity: str = "internal"
    retention_days: int | None = None


class DocTypeOut(DocTypeIn):
    id: str

    class Config:
        from_attributes = True


@router.get("/document-types", response_model=list[DocTypeOut])
def list_types(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(DocumentType).all()


@router.post("/document-types", response_model=DocTypeOut)
def create_type(body: DocTypeIn, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    if db.query(DocumentType).filter(DocumentType.code == body.code).first():
        raise HTTPException(400, "A document type with this code already exists")
    dt = DocumentType(**body.model_dump())
    db.add(dt)
    db.flush()
    record(db, user=user.name, role=user.role, action="admin.doctype_create", detail=f"Created type {dt.code}")
    db.commit()
    return dt


@router.put("/document-types/{type_id}", response_model=DocTypeOut)
def update_type(type_id: str, body: DocTypeIn, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    dt = db.get(DocumentType, type_id)
    if not dt:
        raise HTTPException(404, "Document type not found")
    for k, v in body.model_dump().items():
        setattr(dt, k, v)
    record(db, user=user.name, role=user.role, action="admin.doctype_update", detail=f"Updated type {dt.code}")
    db.commit()
    return dt


class UserIn(BaseModel):
    email: str
    name: str
    password: str
    role: Role = Role.viewer


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    active: bool

    class Config:
        from_attributes = True


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    return db.query(User).all()


@router.post("/users", response_model=UserOut)
def create_user(body: UserIn, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already registered")
    u = User(email=body.email, name=body.name, password_hash=hash_password(body.password), role=body.role)
    db.add(u)
    db.flush()
    record(db, user=user.name, role=user.role, action="admin.user_create", detail=f"Created {u.email} ({u.role})")
    db.commit()
    return u


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, role: Role | None = None, active: bool | None = None,
                 db: Session = Depends(get_db), user: User = Depends(require_roles(Role.admin))):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    changes = []
    if role is not None:
        changes.append(f"role {target.role} -> {role}")
        target.role = role
    if active is not None:
        changes.append(f"active {target.active} -> {active}")
        target.active = active
    record(db, user=user.name, role=user.role, action="admin.user_update", detail=f"{target.email}: {'; '.join(changes)}")
    db.commit()
    return target
