from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_admin
from app.schemas.venta import (
    VentaAnularRequest,
    VentaCrear,
    VentaRespuesta,
    VentaResumen,
)
from app.services import venta_service

router = APIRouter(prefix="/ventas", tags=["Ventas"])


@router.get("/actividad", response_model=list[VentaRespuesta])
@router.get("/actividad-hoy", response_model=list[VentaRespuesta])
def actividad_ventas(
    fecha: Optional[str] = Query(None, description="Fecha comercial YYYY-MM-DD (America/Bogota). Por defecto hoy."),
    usuario_id: Optional[UUID] = Query(None, description="Filtrar por ID de vendedor"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    """
    Timeline cronológico de ventas de un día comercial en Colombia (orden determinista).
    Solo accesible para administradores de la empresa.
    """
    return venta_service.obtener_actividad_ventas(
        admin_user=current_user,
        db=db,
        fecha=fecha,
        usuario_id=usuario_id,
    )


@router.post("/{empresa_id}", response_model=VentaResumen, status_code=status.HTTP_201_CREATED)
def registrar_venta(
    empresa_id: UUID,
    data: VentaCrear,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    return venta_service.registrar_venta(empresa_id, data, current_user, db)


@router.post("/{empresa_id}/{venta_id}/anular", status_code=status.HTTP_200_OK)
def anular_venta(
    empresa_id: UUID,
    venta_id: UUID,
    data: VentaAnularRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    return venta_service.anular_venta(
        empresa_id=empresa_id,
        venta_id=venta_id,
        motivo=data.motivo,
        current_user=current_user,
        db=db,
    )


@router.get("/{empresa_id}", response_model=list[VentaRespuesta])
def listar_ventas(
    empresa_id: UUID,
    fecha_inicio: Optional[datetime] = Query(None, description="ISO datetime — ej: 2026-05-01T00:00:00Z"),
    fecha_fin:    Optional[datetime] = Query(None, description="ISO datetime — ej: 2026-05-12T23:59:59Z"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if current_user.empresa_id != empresa_id:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    return venta_service.obtener_ventas_empresa(empresa_id, db, fecha_inicio, fecha_fin)
