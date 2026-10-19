from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.services.audit_service import registrar_auditoria

router = APIRouter(prefix="/caja", tags=["Caja, Ingresos, Egresos y Arqueo"])


class AbrirCajaRequest(BaseModel):
    monto_inicial: Decimal = Decimal("0.00")
    observaciones: Optional[str] = None

    @field_validator("monto_inicial")
    @classmethod
    def monto_no_negativo(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El monto inicial de apertura no puede ser negativo")
        return v


class MovimientoCajaRequest(BaseModel):
    tipo: Literal["ingreso", "egreso"]
    categoria: str = "gasto_operativo"
    metodo_pago: str = "efectivo"
    monto: Decimal
    concepto: str
    client_operation_id: Optional[str] = None

    @field_validator("tipo", mode="before")
    @classmethod
    def normalizar_tipo(cls, v: str) -> str:
        return str(v or "").strip().lower()

    @field_validator("monto")
    @classmethod
    def monto_positivo(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El monto debe ser mayor a cero")
        return v

    @field_validator("concepto")
    @classmethod
    def concepto_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El concepto es obligatorio")
        return v


class CerrarCajaRequest(BaseModel):
    monto_contado_fisico: Optional[Decimal] = None
    monto_fisico_contado: Optional[Decimal] = None
    observaciones: Optional[str] = None
    notas_cierre: Optional[str] = None

    def obtener_monto_fisico(self) -> Decimal:
        val = self.monto_contado_fisico if self.monto_contado_fisico is not None else self.monto_fisico_contado
        if val is None or val < 0:
            raise ValueError("El monto contado físico no puede ser negativo")
        return val


def _serializar_sesion(sesion: models.SesionCaja) -> dict:
    contado = float(sesion.monto_contado_fisico) if sesion.monto_contado_fisico is not None else None
    return {
        "id": str(sesion.id),
        "empresa_id": str(sesion.empresa_id),
        "estado": sesion.estado,
        "usuario_apertura_id": str(sesion.usuario_apertura_id) if sesion.usuario_apertura_id else None,
        "usuario_apertura_nombre": sesion.usuario_apertura_nombre,
        "usuario_cierre_id": str(sesion.usuario_cierre_id) if sesion.usuario_cierre_id else None,
        "usuario_cierre_nombre": sesion.usuario_cierre_nombre,
        "fecha_apertura": sesion.fecha_apertura.isoformat() if sesion.fecha_apertura else None,
        "fecha_cierre": sesion.fecha_cierre.isoformat() if sesion.fecha_cierre else None,
        "monto_inicial": float(sesion.monto_inicial or 0),
        "total_ventas_efectivo": float(sesion.total_ventas_efectivo or 0),
        "total_ventas_digital": float(sesion.total_ventas_digital or 0),
        "total_ventas_fiado": 0.0,
        "total_ingresos_extra": float(sesion.total_ingresos_extra or 0),
        "total_egresos": float(sesion.total_egresos or 0),
        "saldo_esperado_efectivo": float(sesion.saldo_esperado_efectivo or 0),
        "monto_contado_fisico": contado,
        "monto_fisico_contado": contado,
        "diferencia": float(sesion.diferencia) if sesion.diferencia is not None else None,
        "observaciones": sesion.observaciones,
    }


def _serializar_movimiento(m: models.MovimientoCaja) -> dict:
    return {
        "id": str(m.id),
        "sesion_caja_id": str(m.sesion_caja_id) if m.sesion_caja_id else None,
        "usuario_nombre_snapshot": m.usuario_nombre_snapshot,
        "tipo": m.tipo.upper() if m.tipo else "EGRESO",
        "categoria": m.categoria,
        "metodo_pago": m.metodo_pago,
        "monto": float(m.monto or 0),
        "concepto": m.concepto,
        "referencia_venta_id": str(m.referencia_venta_id) if m.referencia_venta_id else None,
        "fecha": m.fecha.isoformat() if m.fecha else None,
        "client_operation_id": m.client_operation_id,
    }


@router.get("/historial")
def obtener_historial_caja(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    sesiones = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == current_user.empresa_id,
            models.SesionCaja.is_active.is_(True),
        )
        .order_by(models.SesionCaja.fecha_apertura.desc())
        .limit(30)
        .all()
    )
    return [_serializar_sesion(s) for s in sesiones]


@router.get("/estado")
def obtener_estado_caja(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    sesion_abierta = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == current_user.empresa_id,
            models.SesionCaja.estado == "abierta",
            models.SesionCaja.is_active.is_(True),
        )
        .first()
    )

    movimientos_actuales = []
    if sesion_abierta:
        movs = (
            db.query(models.MovimientoCaja)
            .filter(
                models.MovimientoCaja.empresa_id == current_user.empresa_id,
                models.MovimientoCaja.sesion_caja_id == sesion_abierta.id,
                models.MovimientoCaja.is_active.is_(True),
            )
            .order_by(models.MovimientoCaja.fecha.desc())
            .limit(100)
            .all()
        )
        movimientos_actuales = [_serializar_movimiento(m) for m in movs]
    else:
        movs = (
            db.query(models.MovimientoCaja)
            .filter(
                models.MovimientoCaja.empresa_id == current_user.empresa_id,
                models.MovimientoCaja.is_active.is_(True),
            )
            .order_by(models.MovimientoCaja.fecha.desc())
            .limit(50)
            .all()
        )
        movimientos_actuales = [_serializar_movimiento(m) for m in movs]

    historial_cierres = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == current_user.empresa_id,
            models.SesionCaja.estado == "cerrada",
            models.SesionCaja.is_active.is_(True),
        )
        .order_by(models.SesionCaja.fecha_cierre.desc())
        .limit(20)
        .all()
    )

    serializada = _serializar_sesion(sesion_abierta) if sesion_abierta else None
    return {
        "abierta": sesion_abierta is not None,
        "caja_abierta": sesion_abierta is not None,
        "sesion": serializada,
        "sesion_actual": serializada,
        "movimientos": movimientos_actuales,
        "historial_cierres": [_serializar_sesion(s) for s in historial_cierres],
    }


@router.post("/abrir", status_code=status.HTTP_201_CREATED)
def abrir_caja(
    data: AbrirCajaRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    existente = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == current_user.empresa_id,
            models.SesionCaja.estado == "abierta",
            models.SesionCaja.is_active.is_(True),
        )
        .first()
    )
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una sesión de caja abierta en la tienda. Ciérrala antes de abrir un nuevo turno.",
        )

    actor = current_user.nombre or current_user.email
    sesion = models.SesionCaja(
        empresa_id=current_user.empresa_id,
        usuario_apertura_id=current_user.id,
        usuario_apertura_nombre=actor,
        estado="abierta",
        monto_inicial=data.monto_inicial,
        total_ventas_efectivo=Decimal("0.00"),
        total_ventas_digital=Decimal("0.00"),
        total_ingresos_extra=Decimal("0.00"),
        total_egresos=Decimal("0.00"),
        saldo_esperado_efectivo=data.monto_inicial,
        observaciones=data.observaciones,
    )
    db.add(sesion)
    db.flush()

    registrar_auditoria(
        db=db,
        accion="CAJA_ABIERTA",
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        actor_email=current_user.email,
        entidad="sesion_caja",
        entidad_id=str(sesion.id),
        detalle=f"Apertura de caja con base inicial ${float(data.monto_inicial):.2f}",
    )

    db.commit()
    db.refresh(sesion)
    return {
        "mensaje": "Caja abierta exitosamente",
        "sesion": _serializar_sesion(sesion),
    }


@router.post("/movimiento", status_code=status.HTTP_201_CREATED)
def registrar_movimiento_caja(
    data: MovimientoCajaRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if data.client_operation_id:
        previo = (
            db.query(models.MovimientoCaja)
            .filter(
                models.MovimientoCaja.empresa_id == current_user.empresa_id,
                models.MovimientoCaja.client_operation_id == data.client_operation_id,
            )
            .first()
        )
        if previo:
            return {
                "mensaje": "Movimiento de caja ya sincronizado (idempotente)",
                "idempotente": True,
                "movimiento": _serializar_movimiento(previo),
            }

    sesion = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == current_user.empresa_id,
            models.SesionCaja.estado == "abierta",
            models.SesionCaja.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )

    actor = current_user.nombre or current_user.email
    metodo = (data.metodo_pago or "efectivo").lower().strip()
    monto = Decimal(str(data.monto))

    mov = models.MovimientoCaja(
        empresa_id=current_user.empresa_id,
        sesion_caja_id=sesion.id if sesion else None,
        usuario_id=current_user.id,
        usuario_nombre_snapshot=actor,
        tipo=data.tipo,
        categoria=data.categoria.strip(),
        metodo_pago=metodo,
        monto=monto,
        concepto=data.concepto,
        client_operation_id=data.client_operation_id,
    )
    db.add(mov)

    if sesion:
        if data.tipo == "ingreso":
            sesion.total_ingresos_extra = Decimal(str(sesion.total_ingresos_extra or 0)) + monto
            if metodo == "efectivo":
                sesion.saldo_esperado_efectivo = Decimal(str(sesion.saldo_esperado_efectivo or 0)) + monto
        elif data.tipo == "egreso":
            sesion.total_egresos = Decimal(str(sesion.total_egresos or 0)) + monto
            if metodo == "efectivo":
                sesion.saldo_esperado_efectivo = Decimal(str(sesion.saldo_esperado_efectivo or 0)) - monto

    registrar_auditoria(
        db=db,
        accion=f"CAJA_{data.tipo.upper()}",
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        actor_email=current_user.email,
        entidad="movimiento_caja",
        detalle=f"{data.tipo.upper()} (${float(monto):.2f} - {metodo}): {data.concepto}",
    )

    db.commit()
    db.refresh(mov)
    return {
        "mensaje": f"{data.tipo.capitalize()} registrado correctamente",
        "idempotente": False,
        "movimiento": _serializar_movimiento(mov),
        "sesion_actual": _serializar_sesion(sesion) if sesion else None,
    }


@router.post("/cerrar")
def cerrar_caja(
    data: CerrarCajaRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    sesion = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == current_user.empresa_id,
            models.SesionCaja.estado == "abierta",
            models.SesionCaja.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )
    if not sesion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay ninguna sesión de caja abierta para cerrar",
        )

    actor = current_user.nombre or current_user.email
    esperado = Decimal(str(sesion.saldo_esperado_efectivo or 0))
    contado = Decimal(str(data.obtener_monto_fisico()))
    diferencia = contado - esperado
    obs_cierre = data.observaciones or data.notas_cierre

    sesion.estado = "cerrada"
    sesion.fecha_cierre = datetime.now(timezone.utc)
    sesion.usuario_cierre_id = current_user.id
    sesion.usuario_cierre_nombre = actor
    sesion.monto_contado_fisico = contado
    sesion.diferencia = diferencia
    if obs_cierre:
        sesion.observaciones = (
            f"{sesion.observaciones} | Cierre: {obs_cierre}"
            if sesion.observaciones
            else obs_cierre
        )

    registrar_auditoria(
        db=db,
        accion="CAJA_CERRADA",
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        actor_email=current_user.email,
        entidad="sesion_caja",
        entidad_id=str(sesion.id),
        detalle=(
            f"Cierre de caja. Esperado=${float(esperado):.2f}, "
            f"Contado=${float(contado):.2f}, Diferencia=${float(diferencia):.2f}"
        ),
    )

    db.commit()
    db.refresh(sesion)
    estado_arqueo = (
        "CUADRE_EXACTO"
        if diferencia == 0
        else ("SOBRANTE" if diferencia > 0 else "FALTANTE")
    )
    return {
        "mensaje": "Cierre y arqueo de caja completado",
        "diferencia": float(diferencia),
        "estado_arqueo": estado_arqueo,
        "sesion": _serializar_sesion(sesion),
    }
