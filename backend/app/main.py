from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.admin_router import router as admin_router
from app.api.audit_router import router as audit_router
from app.api.auth_router import router as auth_router
from app.api.documents_router import router as documents_router
from app.api.embed_router import router as embed_router
from app.api.integrations_router import router as integrations_router
from app.api.zones_router import router as zones_router
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import Base, engine, ensure_columns
from app.models import base as _models  # noqa: F401  (ensures models are registered before create_all)

Base.metadata.create_all(bind=engine)
ensure_columns("documents", {"title": "VARCHAR(255)", "pre_cropped": "BOOLEAN DEFAULT 0", "kind_hint": "VARCHAR(32)"})

app = FastAPI(title=settings.app_name)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
# zones_router must be registered before documents_router: both share the
# "/api/documents" prefix, and documents_router's GET /{doc_id} would otherwise
# match a request for "/api/documents/zones-health" first (treating "zones-health"
# as a doc_id) and reject it under JWT auth before zones_router ever sees it.
app.include_router(zones_router, prefix="/api/documents", tags=["zones"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(integrations_router, prefix="/api/integrations", tags=["integrations"])
app.include_router(audit_router, prefix="/api/audit", tags=["audit"])
app.include_router(embed_router, prefix="/api/embed", tags=["embed"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
