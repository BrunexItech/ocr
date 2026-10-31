from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.core.audit import record
from app.db.session import get_db
from app.models.base import Role, User

router = APIRouter()


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True


class RegisterIn(BaseModel):
    email: str
    name: str
    password: str


@router.post("/register", response_model=UserOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """First registered user becomes admin; later ones default to viewer (admin promotes them)."""
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already registered")
    is_first = db.query(User).count() == 0
    user = User(email=body.email, name=body.name, password_hash=hash_password(body.password),
                role=Role.admin if is_first else Role.viewer)
    db.add(user)
    db.flush()
    record(db, user=user.name, role=user.role, action="auth.register", detail="Account created")
    db.commit()
    return user


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    record(db, user=user.name, role=user.role, action="auth.login", detail="Signed in")
    db.commit()
    token = create_access_token(user.id, user.role)
    return {"access_token": token, "token_type": "bearer", "role": user.role}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
