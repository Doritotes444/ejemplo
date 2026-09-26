import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.schemas.usuario import UsuarioCrear
from app.core.logging import log_security_event

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY no está configurada en las variables de entorno")

# Algoritmo de firma fijo — no configurable via env para evitar algorithm-confusion attacks
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def crear_token_acceso(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------

def registrar_usuario(data: UsuarioCrear, db: Session, ip: str = "unknown") -> models.Usuario:
    # pre-check: email duplicado (previene HTTP 409 / duplicate key en BD)
    if db.query(models.Usuario).filter(
        models.Usuario.email == data.email
    ).first():
        log_security_event("REGISTRATION_FAILED_EMAIL_DUPLICATE", data.email, ip=ip, level="WARNING")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este email ya está registrado",
        )

    # pre-check: empresa existe y está activa
    empresa = db.query(models.Empresa).filter(
        models.Empresa.id == data.empresa_id,
        models.Empresa.is_active.is_(True),
    ).first()
    if not empresa:
        log_security_event("REGISTRATION_FAILED_COMPANY_NOT_FOUND", data.email, ip=ip, level="WARNING")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada",
        )

    usuario = models.Usuario(
        email=data.email,
        hashed_password=hash_password(data.password),
        empresa_id=data.empresa_id,
        rol=data.rol,
        is_active=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    log_security_event("REGISTRATION_SUCCESS", usuario.email, user_id=str(usuario.id), ip=ip)
    return usuario


def registrar_usuario_con_empresa(
    nombre_comercial: str,
    nit_o_cedula: str,
    email: str,
    password: str,
    rol: models.RolUsuario,
    db: Session,
    ip: str = "unknown",
) -> dict:
    # Pre-check: email duplicado (previene conflict de BD)
    if db.query(models.Usuario).filter(models.Usuario.email == email).first():
        log_security_event("REGISTRATION_FAILED_EMAIL_DUPLICATE", email, ip=ip, level="WARNING")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este email ya está registrado",
        )

    # Pre-check: NIT duplicado
    if db.query(models.Empresa).filter(models.Empresa.nit_o_cedula == nit_o_cedula).first():
        log_security_event("REGISTRATION_FAILED_NIT_DUPLICATE", email, ip=ip, level="WARNING")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una empresa con NIT/Cédula '{nit_o_cedula}'",
        )

    try:
        from app.services import entitlement_service
        empresa = models.Empresa(
            nombre_comercial=nombre_comercial.strip(),
            nit_o_cedula=nit_o_cedula.strip(),
            is_active=True,
        )
        entitlement_service.inicializar_trial(empresa)
        db.add(empresa)
        db.flush()

        usuario = models.Usuario(
            email=email,
            hashed_password=hash_password(password),
            empresa_id=empresa.id,
            rol=rol,
            is_active=True,
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        token = crear_token_acceso({"sub": str(usuario.id)})
        log_security_event("REGISTRATION_WITH_COMPANY_SUCCESS", email, user_id=str(usuario.id), ip=ip)
        return {"access_token": token, "token_type": "bearer", "usuario": usuario}  # nosec B105

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        log_security_event("REGISTRATION_WITH_COMPANY_ERROR", email, ip=ip, level="ERROR")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error durante el registro: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def login_usuario(email: str, password: str, db: Session, ip: str = "unknown") -> dict:
    # Mensaje genérico para no revelar si el email existe (enumeración)
    _credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    usuario = db.query(models.Usuario).filter(
        models.Usuario.email == email,
    ).first()

    if not usuario or not verificar_password(password, usuario.hashed_password):
        log_security_event("LOGIN_FAILED", email, ip=ip, level="WARNING")
        raise _credenciales_invalidas

    if not usuario.is_active:
        log_security_event("LOGIN_BLOCKED_INACTIVE_USER", email, user_id=str(usuario.id), ip=ip, level="WARNING")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacta al administrador.",
        )

    token = crear_token_acceso({"sub": str(usuario.id)})
    log_security_event("LOGIN_SUCCESS", usuario.email, user_id=str(usuario.id), ip=ip)
    return {"access_token": token, "token_type": "bearer", "usuario": usuario}  # nosec B105
