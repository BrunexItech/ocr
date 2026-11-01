from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


# "timeout" makes SQLite wait (rather than immediately raise "database is locked") if
# another connection briefly holds the write lock - matters once more than one request
# can touch the DB at once, even with a single worker process (FastAPI runs sync route
# handlers in a thread pool).
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 30} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns(table: str, columns: dict[str, str]) -> None:
    """Add any missing columns to an existing table (there's no Alembic here, just
    create_all - which only creates tables, never alters existing ones). Safe to call
    every startup: skips columns that already exist."""
    with engine.connect() as conn:
        existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
        for name, ddl_type in columns.items():
            if name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}")
        conn.commit()
