from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.schemas.empresa import EmpresaCrear


def crear_empresa(data: EmpresaCrear, db: Session) -> models.Empresa:
    # pre-check: NIT/Cédula duplicado
    if db.query(models.Empresa).filter(
        models.Empresa.nit_o_cedula == data.nit_o_cedula
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una empresa con NIT/Cédula '{data.nit_o_cedula}'",
        )

    from app.services import entitlement_service
    empresa = models.Empresa(
        nombre_comercial=data.nombre_comercial,
        nit_o_cedula=data.nit_o_cedula,
        plan=models.PlanEmpresa.BASIC,
    )
    entitlement_service.inicializar_trial(empresa)
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return empresa


def obtener_empresa(empresa_id: UUID, db: Session) -> models.Empresa:
    empresa = db.query(models.Empresa).filter(
        models.Empresa.id == empresa_id,
        models.Empresa.is_active.is_(True),
    ).first()
    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada",
        )
    return empresa
