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
