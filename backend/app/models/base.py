import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def gen_id() -> str:
    return uuid.uuid4().hex


class Role(str, enum.Enum):
    admin = "admin"
    approver = "approver"
    reviewer = "reviewer"
    intake = "intake"
    viewer = "viewer"


# Roles that may view unmasked sensitive fields (national IDs, salaries, medical notes, etc.)
REVEAL_ROLES = {Role.admin, Role.approver}

DocStatus = Enum(
    "queued", "processing", "awaiting_review", "awaiting_approval", "approved", "rejected", "failed",
    name="doc_status",
)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(Enum(Role), default=Role.viewer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DocumentType(Base):
    """Admin-configurable schema: no document kind is hardcoded in the pipeline."""
    __tablename__ = "document_types"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    domain: Mapped[str] = mapped_column(String(64), default="generic")  # e.g. school, hospital, fintech, sports
    fields_schema: Mapped[dict] = mapped_column(JSON, default=dict)  # {field_key: {label, type, required, sensitive}}
    default_sensitivity: Mapped[str] = mapped_column(String(32), default="internal")  # public/internal/sensitive
    retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    tracking_no: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    pre_cropped: Mapped[bool] = mapped_column(Boolean, default=False)  # stored file is already final (e.g. stitched front+back) - don't re-crop on preview
    type_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("document_types.id"), nullable=True)
    status: Mapped[str] = mapped_column(DocStatus, default="queued")
    sensitivity: Mapped[str] = mapped_column(String(32), default="internal")
    file_name: Mapped[str] = mapped_column(String(512))
    file_path: Mapped[str] = mapped_column(String(1024))
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    fields: Mapped[dict] = mapped_column(JSON, default=dict)  # current extracted/corrected field values
    field_confidence: Mapped[dict] = mapped_column(JSON, default=dict)
    reasons: Mapped[list] = mapped_column(JSON, default=list)  # why it needs review
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)

    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document", order_by="DocumentVersion.version", cascade="all, delete-orphan"
    )


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    document_id: Mapped[str] = mapped_column(String(32), ForeignKey("documents.id"))
    version: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(String(512))
    changes: Mapped[list] = mapped_column(JSON, default=list)
    user: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document: Mapped[Document] = relationship(back_populates="versions")


class AuditEvent(Base):
    """Append-only, hash-chained audit log. Each row hashes the previous row's hash."""
    __tablename__ = "audit_events"
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(128))
    document_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    detail: Mapped[str] = mapped_column(String(1024), default="")
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class Integration(Base):
    """A configured downstream database/system that approved records can be pushed to."""
    __tablename__ = "integrations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(32))  # webhook | csv_export | db (future)
    config: Mapped[dict] = mapped_column(JSON, default=dict)  # e.g. {"url": "..."} for webhook
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceAccount(Base):
    """A non-human caller (another system, e.g. a partner registry) authenticating
    with an API key instead of a user login. Only the key's hash is ever stored."""
    __tablename__ = "service_accounts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String(255))
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(12))  # shown in UI/logs so a key is identifiable without revealing it
    role: Mapped[str] = mapped_column(Enum(Role), default=Role.intake)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
