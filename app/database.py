import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL no está configurada. "
        "Copia .env.example a .env y completa tus credenciales."
    )

# Render / Railway / Supabase proveen la URL como postgres://; SQLAlchemy 2.0 requiere postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


# SQLite (usado en tests) no soporta pool_size ni max_overflow.
# PostgreSQL (producción) sí los necesita para Supabase free tier.
_is_sqlite = DATABASE_URL.startswith("sqlite")
_engine_kwargs: dict = {
    "pool_pre_ping": not _is_sqlite,  # SQLite no tiene pool real
    "echo": os.getenv("ENVIRONMENT") == "development",
}
if not _is_sqlite:
    _engine_kwargs["pool_size"] = 5       # Supabase free: máx ~15 conexiones
    _engine_kwargs["max_overflow"] = 10
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency de FastAPI: provee una sesión de BD y garantiza su cierre."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
