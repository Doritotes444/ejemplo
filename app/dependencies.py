from datetime import datetime, timezone
import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.models import RolUsuario
from app.services.auth_service import ALGORITHM, SECRET_KEY

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.Usuario:
    _no_autenticado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise _no_autenticado
        # Convertir string UUID a UUID object para comparación correcta
        try:
            user_id_uuid = uuid.UUID(user_id)
        except (ValueError, TypeError):
            raise _no_autenticado
    except jwt.InvalidTokenError:
        raise _no_autenticado

    usuario = db.query(models.Usuario).filter(
        models.Usuario.id == user_id_uuid,
    ).first()

    if not usuario:
        raise _no_autenticado

    if not usuario.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacta al administrador.",
        )

    empresa = db.query(models.Empresa).filter(
        models.Empresa.id == usuario.empresa_id,
        models.Empresa.is_active.is_(True),
    ).first()

    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Empresa inactiva o no encontrada",
        )

    return usuario


def require_pro_entitlement(
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.Usuario:
    """Verifica que la empresa del usuario autenticado tenga derecho de uso Pro (o trial de 15 días activo).
    
    Aplica principio Fail-Closed y aislamiento estricto por empresa.
    """
    empresa = db.query(models.Empresa).filter(
        models.Empresa.id == current_user.empresa_id,
        models.Empresa.is_active.is_(True),
    ).first()

    from app.services import entitlement_service
    tiene_acceso, estado, meta = entitlement_service.verificar_acceso_pro(empresa)
    if not tiene_acceso:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PRO_REQUIRED",
                "message": "Esta función requiere el Plan Pro o una prueba activa de 15 días.",
                "estado_suscripcion": estado,
                "dias_trial_restantes": meta.get("dias_trial_restantes", 0),
            },
        )
    return current_user


def get_current_user_admin(
    current_user: models.Usuario = Depends(get_current_user),
) -> models.Usuario:
    if current_user.rol != RolUsuario.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return current_user
