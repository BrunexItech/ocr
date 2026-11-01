from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin_router import router as admin_router
from app.api.audit_router import router as audit_router
from app.api.auth_router import router as auth_router
from app.api.documents_router import router as documents_router
from app.api.integrations_router import router as integrations_router
from app.api.zones_router import router as zones_router
from app.core.config import settings
from app.db.session import Base, engine, ensure_columns
from app.models import base as _models  # noqa: F401  (ensures models are registered before create_all)

Base.metadata.create_all(bind=engine)
ensure_columns("documents", {"title": "VARCHAR(255)", "pre_cropped": "BOOLEAN DEFAULT 0"})

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(integrations_router, prefix="/api/integrations", tags=["integrations"])
app.include_router(audit_router, prefix="/api/audit", tags=["audit"])
app.include_router(zones_router, prefix="/api/documents", tags=["zones"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
