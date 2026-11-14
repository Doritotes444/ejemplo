"""
Módulo de Seguridad, Hashing de Contraseñas (PBKDF2-HMAC-SHA256),
Gestión de Sesiones Persistentes y Control de Acceso Basado en Roles (RBAC).
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.database import new_id, now_iso

PBKDF2_ITERATIONS = 260_000
SESSION_DURATION_HOURS = 24 * 7  # 7 días

ROLE_DUENO = "dueno"
ROLE_TENDERO = "tendero"
VALID_ROLES = {ROLE_DUENO, ROLE_TENDERO}


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def hash_password(plain_password: str) -> str:
    if not plain_password or len(plain_password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        bytes.fromhex(salt),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_str, salt, expected_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_str)
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            bytes.fromhex(salt),
            iterations,
        )
        return hmac.compare_digest(dk.hex(), expected_hex)
    except Exception:
        return False


def hash_session_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_session(conn, user_id: str, ip_address: str = "", user_agent: str = "") -> str:
    raw_token = secrets.token_urlsafe(36)
    token_hash = hash_session_token(raw_token)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    expires = now + timedelta(hours=SESSION_DURATION_HOURS)

    conn.execute(
        """
        INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id("ses"),
            user_id,
            token_hash,
            now.isoformat(),
            expires.isoformat(),
            ip_address[:80] if ip_address else None,
            user_agent[:255] if user_agent else None,
        ),
    )
    return raw_token


def revoke_session(conn, raw_token: str) -> None:
    if not raw_token:
        return
    token_hash = hash_session_token(raw_token)
    conn.execute(
        "UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
        (now_iso(), token_hash),
    )


def revoke_all_user_sessions(conn, user_id: str) -> None:
    conn.execute(
        "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
        (now_iso(), user_id),
    )


def get_authenticated_user(conn, raw_token: Optional[str]) -> dict:
    if not raw_token:
        raise AuthError("Sesión no iniciada o token ausente.", 401)

    token_hash = hash_session_token(raw_token)
    row = conn.execute(
        """
        SELECT
            s.id AS session_id,
            s.expires_at,
            s.revoked_at,
            u.id AS user_id,
            u.username,
            u.full_name,
            u.role_code,
            u.is_active,
            r.name AS role_name
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        JOIN roles r ON r.code = u.role_code
        WHERE s.token_hash = ?
        """,
        (token_hash,),
    ).fetchone()

    if not row:
        raise AuthError("Sesión inválida o inexistente.", 401)

    if row["revoked_at"] is not None:
        raise AuthError("La sesión ha sido cerrada.", 401)

    if not row["is_active"]:
        raise AuthError("El usuario se encuentra desactivado.", 403)

    now_str = now_iso()
    if row["expires_at"] < now_str:
        raise AuthError("La sesión ha expirado. Inicia sesión nuevamente.", 401)

    return {
        "id": row["user_id"],
        "username": row["username"],
        "full_name": row["full_name"],
        "role": row["role_code"],
        "role_name": row["role_name"],
        "is_active": bool(row["is_active"]),
    }


def require_role(user: dict, allowed_roles: set) -> None:
    if not user:
        raise AuthError("No autenticado.", 401)
    if user.get("role") not in allowed_roles:
        raise AuthError(
            "Acceso denegado: tu rol no tiene permisos para ejecutar esta operación.",
            403,
        )
