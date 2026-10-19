import hashlib
import os
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.schemas.usuario import UsuarioCrear
from app.core.logging import log_security_event
from app.services.audit_service import registrar_auditoria

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY no está configurada en las variables de entorno")

# Algoritmo de firma fijo — no configurable via env para evitar algorithm-confusion attacks
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# Protección contra fuerza bruta (ventana móvil de 5 minutos por IP+email)
_FAILED_ATTEMPTS: dict[str, list[datetime]] = defaultdict(list)
MAX_FAILED_LOGIN_ATTEMPTS = int(os.getenv("MAX_FAILED_LOGIN_ATTEMPTS", "10"))
LOCKOUT_WINDOW_SECONDS = 300


def _check_rate_limit(key: str) -> None:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=LOCKOUT_WINDOW_SECONDS)
    _FAILED_ATTEMPTS[key] = [t for t in _FAILED_ATTEMPTS[key] if t > cutoff]
    if len(_FAILED_ATTEMPTS[key]) >= MAX_FAILED_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Espera 5 minutos antes de volver a intentar.",
        )


def _record_failed_attempt(key: str) -> None:
    _FAILED_ATTEMPTS[key].append(datetime.now(timezone.utc))


def _clear_failed_attempts(key: str) -> None:
    _FAILED_ATTEMPTS.pop(key, None)


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

    # Seguridad multi-tenant: si la empresa ya tiene usuarios registrados, prohibir auto-registro público
    existing_users_count = db.query(models.Usuario).filter(
        models.Usuario.empresa_id == data.empresa_id
    ).count()
    if existing_users_count > 0:
        log_security_event("REGISTRATION_BLOCKED_EXISTING_TENANT", data.email, ip=ip, level="WARNING")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta tienda ya cuenta con un administrador. El dueño debe crear nuevos usuarios desde su panel.",
        )

    usuario = models.Usuario(
        nombre=data.nombre,
        email=data.email,
        hashed_password=hash_password(data.password),
        empresa_id=data.empresa_id,
        rol=data.rol,
        is_active=True,
    )
    db.add(usuario)
    registrar_auditoria(
        db=db,
        accion="REGISTRO_USUARIO",
        empresa_id=empresa.id,
        usuario_id=usuario.id,
        actor_email=usuario.email,
        entidad="usuario",
        entidad_id=str(usuario.id),
        detalle=f"Registro inicial en empresa {empresa.nombre_comercial}",
        ip_address=ip,
    )
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
    nombre: Optional[str] = None,
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
            nombre=(nombre or nombre_comercial).strip(),
            email=email,
            hashed_password=hash_password(password),
            empresa_id=empresa.id,
            rol=rol,
            is_active=True,
        )
        db.add(usuario)
        db.flush()

        registrar_auditoria(
            db=db,
            accion="REGISTRO_TIENDA",
            empresa_id=empresa.id,
            usuario_id=usuario.id,
            actor_email=usuario.email,
            entidad="empresa",
            entidad_id=str(empresa.id),
            detalle=f"Tienda '{empresa.nombre_comercial}' registrada con NIT {empresa.nit_o_cedula}",
            ip_address=ip,
        )
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
    rate_key = f"{ip}:{email.lower().strip()}"
    _check_rate_limit(rate_key)

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
        _record_failed_attempt(rate_key)
        log_security_event("LOGIN_FAILED", email, ip=ip, level="WARNING")
        registrar_auditoria(
            db=db,
            accion="LOGIN_FAILED",
            empresa_id=usuario.empresa_id if usuario else None,
            usuario_id=usuario.id if usuario else None,
            actor_email=email,
            entidad="auth",
            detalle="Intento fallido de inicio de sesión",
            ip_address=ip,
            commit=True,
        )
        raise _credenciales_invalidas

    if not usuario.is_active:
        log_security_event("LOGIN_BLOCKED_INACTIVE_USER", email, user_id=str(usuario.id), ip=ip, level="WARNING")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacta al administrador.",
        )

    _clear_failed_attempts(rate_key)
    token = crear_token_acceso({"sub": str(usuario.id)})
    log_security_event("LOGIN_SUCCESS", usuario.email, user_id=str(usuario.id), ip=ip)
    registrar_auditoria(
        db=db,
        accion="LOGIN_SUCCESS",
        empresa_id=usuario.empresa_id,
        usuario_id=usuario.id,
        actor_email=usuario.email,
        entidad="auth",
        entidad_id=str(usuario.id),
        detalle="Inicio de sesión exitoso",
        ip_address=ip,
        commit=True,
    )
    return {"access_token": token, "token_type": "bearer", "usuario": usuario}  # nosec B105


# ---------------------------------------------------------------------------
# Recuperación y cambio de contraseña
# ---------------------------------------------------------------------------

def solicitar_recuperacion_password(email: str, db: Session, ip: str = "unknown") -> dict:
    usuario = db.query(models.Usuario).filter(
        models.Usuario.email == email.strip(),
        models.Usuario.is_active.is_(True),
    ).first()

    respuesta = {
        "mensaje": "Si el correo electrónico está registrado, se ha generado el código de recuperación.",
        "expires_in_minutes": 30,
    }

    if not usuario:
        log_security_event("PASSWORD_RESET_UNKNOWN_EMAIL", email, ip=ip, level="WARNING")
        return respuesta

    raw_token = secrets.token_urlsafe(24)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

    reset_entry = models.PasswordResetToken(
        usuario_id=usuario.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(reset_entry)
    registrar_auditoria(
        db=db,
        accion="PASSWORD_RESET_REQUESTED",
        empresa_id=usuario.empresa_id,
        usuario_id=usuario.id,
        actor_email=usuario.email,
        entidad="usuario",
        entidad_id=str(usuario.id),
        detalle="Solicitud de recuperación de contraseña",
        ip_address=ip,
        commit=True,
    )
    log_security_event("PASSWORD_RESET_REQUESTED", usuario.email, user_id=str(usuario.id), ip=ip)

    # Si no hay servidor SMTP externo configurado, proveemos el token en modo local/demo verificable
    if not os.getenv("SMTP_HOST"):
        respuesta["reset_token_dev"] = raw_token
        respuesta["token_desarrollo"] = raw_token
        respuesta["modo_entrega"] = "local_demo_sin_smtp"
    else:
        respuesta["modo_entrega"] = "smtp"

    return respuesta


def confirmar_recuperacion_password(token: str, new_password: str, db: Session, ip: str = "unknown") -> dict:
    token_hash = hashlib.sha256(token.strip().encode("utf-8")).hexdigest()
    reset_entry = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token_hash == token_hash,
        models.PasswordResetToken.used_at.is_(None),
    ).first()

    if not reset_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de recuperación es inválido o ya fue utilizado.",
        )

    now = datetime.now(timezone.utc)
    expires_at = reset_entry.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de recuperación ha expirado. Solicita uno nuevo.",
        )

    usuario = db.query(models.Usuario).filter(models.Usuario.id == reset_entry.usuario_id).first()
    if not usuario or not usuario.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado o inactivo.",
        )

    usuario.hashed_password = hash_password(new_password)
    reset_entry.used_at = now
    registrar_auditoria(
        db=db,
        accion="PASSWORD_RESET_COMPLETED",
        empresa_id=usuario.empresa_id,
        usuario_id=usuario.id,
        actor_email=usuario.email,
        entidad="usuario",
        entidad_id=str(usuario.id),
        detalle="Contraseña actualizada mediante código de recuperación",
        ip_address=ip,
        commit=True,
    )
    log_security_event("PASSWORD_RESET_COMPLETED", usuario.email, user_id=str(usuario.id), ip=ip)
    return {"mensaje": "Contraseña actualizada correctamente. Ya puedes iniciar sesión."}


def cambiar_password_autenticado(
    usuario: models.Usuario,
    current_password: str,
    new_password: str,
    db: Session,
    ip: str = "unknown",
) -> dict:
    if not verificar_password(current_password, usuario.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual no es correcta.",
        )
    usuario.hashed_password = hash_password(new_password)
    registrar_auditoria(
        db=db,
        accion="PASSWORD_CHANGED",
        empresa_id=usuario.empresa_id,
        usuario_id=usuario.id,
        actor_email=usuario.email,
        entidad="usuario",
        entidad_id=str(usuario.id),
        detalle="Cambio de contraseña por usuario autenticado",
        ip_address=ip,
        commit=True,
    )
    return {"mensaje": "Contraseña actualizada exitosamente."}
