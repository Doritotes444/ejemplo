import logging
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger("tiendapp.audit")


def registrar_auditoria(
    db: Session,
    accion: str,
    empresa_id: Optional[UUID] = None,
    usuario_id: Optional[UUID] = None,
    actor_email: Optional[str] = None,
    entidad: Optional[str] = None,
    entidad_id: Optional[str] = None,
    detalle: Optional[str] = None,
    ip_address: Optional[str] = None,
    commit: bool = False,
) -> Optional[models.AuditLog]:
    """
    Registra un evento de auditoría persistente en la tabla audit_logs.
    Nunca lanza excepción hacia el flujo principal si ocurre un error de log,
    pero persiste dentro de la sesión actual.
    """
    try:
        log = models.AuditLog(
            empresa_id=empresa_id,
            usuario_id=usuario_id,
            actor_email=actor_email,
            accion=accion,
            entidad=entidad,
            entidad_id=str(entidad_id) if entidad_id else None,
            detalle=detalle,
            ip_address=ip_address,
        )
        db.add(log)
        if commit:
            db.commit()
            db.refresh(log)
        logger.info(
            "AUDIT [%s] empresa=%s actor=%s entidad=%s:%s detalle=%s",
            accion, empresa_id, actor_email, entidad, entidad_id, detalle,
        )
        return log
    except Exception as exc:
        logger.warning("No se pudo persistir AuditLog (%s): %s", accion, exc)
        return None
