from datetime import datetime, timezone, timedelta, date, time
from decimal import Decimal
from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import models
from app.schemas.venta import VentaCrear, VentaResumen
from app.services.audit_service import registrar_auditoria

try:
    COLOMBIA_TZ = ZoneInfo("America/Bogota")
except Exception:
    COLOMBIA_TZ = timezone(timedelta(hours=-5))


def registrar_venta(
    empresa_id: UUID,
    data: VentaCrear,
    current_user: models.Usuario,
    db: Session,
    commit: bool = True,
) -> VentaResumen:
    """
    Registra una venta completa en una transacción ACID con:
    - Idempotencia mediante client_operation_id (para sincronización offline sin duplicados).
    - Descuento de inventario con bloqueo de fila (SELECT FOR UPDATE).
    - Registro auditable en MovimientoInventario (tipo="venta").
    - Snapshot de costo_unitario_snapshot para utilidad real.
    - Integración automática con la Sesión de Caja abierta (si existe).
    """
    # 1. Multi-tenant: el usuario solo puede operar en su propia empresa
    if current_user.empresa_id != empresa_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para operar en esta empresa",
        )

    # 1b. Idempotencia para sincronización offline
    if data.client_operation_id:
        venta_existente = (
            db.query(models.Venta)
            .filter(
                models.Venta.empresa_id == empresa_id,
                models.Venta.client_operation_id == data.client_operation_id,
            )
            .first()
        )
        if venta_existente:
            return VentaResumen(
                mensaje="Venta ya sincronizada previamente (idempotente)",
                total=float(venta_existente.total),
                venta_id=venta_existente.id,
                metodo_pago=venta_existente.metodo_pago or "efectivo",
                cambio_entregado=float(venta_existente.cambio_entregado or 0.0),
                idempotente=True,
                client_operation_id=venta_existente.client_operation_id,
            )

    # Buscar sesión de caja abierta (si existe) para vincular la venta automáticamente
    sesion_activa = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == empresa_id,
            models.SesionCaja.estado == "abierta",
            models.SesionCaja.is_active.is_(True),
        )
        .first()
    )

    metodo_pago = (data.metodo_pago or "efectivo").lower().strip()
    vendedor_snapshot = current_user.nombre or current_user.email

    # 2. Crear el documento maestro de venta con total provisional = 0 y trazabilidad inmutable
    nueva_venta = models.Venta(
        empresa_id=empresa_id,
        total=Decimal("0.00"),
        fecha_venta=datetime.now(COLOMBIA_TZ),
        is_active=True,
        usuario_id=current_user.id,
        vendedor_nombre_snapshot=vendedor_snapshot,
        metodo_pago=metodo_pago,
        estado="completada",
        sesion_caja_id=sesion_activa.id if sesion_activa else None,
        client_operation_id=data.client_operation_id,
        cliente_nombre=data.cliente_nombre,
        notas=data.notas,
    )
    db.add(nueva_venta)
    db.flush()

    total_venta = Decimal("0.00")

    try:
        for item in data.detalles:
            producto = (
                db.query(models.Producto)
                .filter(
                    models.Producto.id == item.producto_id,
                    models.Producto.empresa_id == empresa_id,
                    models.Producto.is_active.is_(True),
                )
                .with_for_update()
                .first()
            )

            if not producto:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Producto '{item.producto_id}' no encontrado "
                        "o no pertenece a esta empresa"
                    ),
                )

            if producto.cantidad_actual < item.cantidad:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Stock insuficiente para '{producto.nombre}'. "
                        f"Disponible: {producto.cantidad_actual}, "
                        f"Solicitado: {item.cantidad}"
                    ),
                )

            stock_anterior = Decimal(str(producto.cantidad_actual))
            producto.cantidad_actual -= item.cantidad
            stock_nuevo = Decimal(str(producto.cantidad_actual))

            subtotal = producto.precio_venta * item.cantidad
            total_venta += subtotal

            detalle = models.DetalleVenta(
                venta_id=nueva_venta.id,
                producto_id=item.producto_id,
                cantidad=item.cantidad,
                precio_unitario=producto.precio_venta,
                costo_unitario_snapshot=producto.precio_costo,
                subtotal=subtotal,
            )
            db.add(detalle)

            mov_inv = models.MovimientoInventario(
                empresa_id=empresa_id,
                producto_id=producto.id,
                usuario_id=current_user.id,
                usuario_nombre_snapshot=vendedor_snapshot,
                tipo="venta",
                cantidad=item.cantidad,
                stock_anterior=stock_anterior,
                stock_nuevo=stock_nuevo,
                costo_unitario=producto.precio_costo,
                motivo=f"Venta POS #{str(nueva_venta.id)[:8]}",
                referencia_id=str(nueva_venta.id),
            )
            db.add(mov_inv)

        nueva_venta.total = total_venta

        # Calcular cambio entregado cuando se envía monto_recibido
        cambio = Decimal("0.00")
        if data.monto_recibido is not None:
            monto_rec = Decimal(str(data.monto_recibido))
            if monto_rec >= total_venta:
                cambio = monto_rec - total_venta
            nueva_venta.monto_recibido = monto_rec
        else:
            nueva_venta.monto_recibido = total_venta
        nueva_venta.cambio_entregado = cambio

        # Actualizar sesión de caja activa y registrar MovimientoCaja
        if sesion_activa:
            if metodo_pago == "efectivo":
                sesion_activa.total_ventas_efectivo = Decimal(str(sesion_activa.total_ventas_efectivo or 0)) + total_venta
                sesion_activa.saldo_esperado_efectivo = Decimal(str(sesion_activa.saldo_esperado_efectivo or 0)) + total_venta
            elif metodo_pago != "fiado":
                sesion_activa.total_ventas_digital = Decimal(str(sesion_activa.total_ventas_digital or 0)) + total_venta

        mov_caja = models.MovimientoCaja(
            empresa_id=empresa_id,
            sesion_caja_id=sesion_activa.id if sesion_activa else None,
            usuario_id=current_user.id,
            usuario_nombre_snapshot=vendedor_snapshot,
            tipo="venta",
            categoria="venta_pos",
            metodo_pago=metodo_pago,
            monto=total_venta,
            concepto=f"Venta POS #{str(nueva_venta.id)[:8]} ({metodo_pago.upper()})",
            referencia_venta_id=nueva_venta.id,
        )
        db.add(mov_caja)

        registrar_auditoria(
            db=db,
            accion="VENTA_REGISTRADA",
            empresa_id=empresa_id,
            usuario_id=current_user.id,
            actor_email=current_user.email,
            entidad="venta",
            entidad_id=str(nueva_venta.id),
            detalle=f"Total=${float(total_venta):.2f} metodo={metodo_pago}",
        )

        if commit:
            db.commit()
        else:
            db.flush()

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al procesar la venta",
        ) from exc

    return VentaResumen(
        mensaje="Venta registrada exitosamente",
        total=float(total_venta),
        venta_id=nueva_venta.id,
        metodo_pago=metodo_pago,
        cambio_entregado=float(cambio),
        idempotente=False,
        client_operation_id=nueva_venta.client_operation_id,
    )


def anular_venta(
    empresa_id: UUID,
    venta_id: UUID,
    motivo: str,
    current_user: models.Usuario,
    db: Session,
) -> dict:
    """
    Anula una venta de forma auditable (Sección 10):
    - Nunca borra físicamente la venta.
    - Marca estado='anulada', motivo_anulacion, anulada_por_id y anulada_en.
    - Revierte el stock en Producto y registra MovimientoInventario(tipo='anulacion_venta').
    - Revierte el saldo en SesionCaja y registra MovimientoCaja(tipo='anulacion_venta').
    - Registra AuditLog('VENTA_ANULADA').
    """
    if current_user.empresa_id != empresa_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para operar en esta empresa",
        )

    venta = (
        db.query(models.Venta)
        .options(joinedload(models.Venta.detalles))
        .filter(
            models.Venta.id == venta_id,
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )
    if not venta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada",
        )

    if venta.estado == "anulada":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta venta ya fue anulada anteriormente",
        )

    ahora = datetime.now(COLOMBIA_TZ)
    actor_nombre = current_user.nombre or current_user.email

    # 1. Revertir inventario por cada detalle
    for det in venta.detalles:
        producto = (
            db.query(models.Producto)
            .filter(
                models.Producto.id == det.producto_id,
                models.Producto.empresa_id == empresa_id,
            )
            .with_for_update()
            .first()
        )
        if producto:
            stock_anterior = Decimal(str(producto.cantidad_actual))
            producto.cantidad_actual = stock_anterior + Decimal(str(det.cantidad))
            stock_nuevo = Decimal(str(producto.cantidad_actual))

            mov_inv = models.MovimientoInventario(
                empresa_id=empresa_id,
                producto_id=producto.id,
                usuario_id=current_user.id,
                usuario_nombre_snapshot=actor_nombre,
                tipo="anulacion_venta",
                cantidad=det.cantidad,
                stock_anterior=stock_anterior,
                stock_nuevo=stock_nuevo,
                costo_unitario=det.costo_unitario_snapshot or producto.precio_costo,
                motivo=f"Anulación de venta #{str(venta.id)[:8]}: {motivo}",
                referencia_id=str(venta.id),
            )
            db.add(mov_inv)

    # 2. Marcar venta como anulada (sin borrarla)
    venta.estado = "anulada"
    venta.motivo_anulacion = motivo.strip()
    venta.anulada_por_id = current_user.id
    venta.anulada_en = ahora

    # 3. Revertir impacto en caja
    sesion_caja = None
    if venta.sesion_caja_id:
        sesion_caja = db.query(models.SesionCaja).filter(models.SesionCaja.id == venta.sesion_caja_id).first()
    if not sesion_caja or sesion_caja.estado != "abierta":
        sesion_caja = (
            db.query(models.SesionCaja)
            .filter(
                models.SesionCaja.empresa_id == empresa_id,
                models.SesionCaja.estado == "abierta",
                models.SesionCaja.is_active.is_(True),
            )
            .first()
        )

    total_venta = Decimal(str(venta.total))
    metodo_pago = (venta.metodo_pago or "efectivo").lower()
    if sesion_caja and sesion_caja.estado == "abierta":
        if metodo_pago == "efectivo":
            sesion_caja.total_ventas_efectivo = max(
                Decimal("0.00"),
                Decimal(str(sesion_caja.total_ventas_efectivo or 0)) - total_venta,
            )
            sesion_caja.saldo_esperado_efectivo = Decimal(str(sesion_caja.saldo_esperado_efectivo or 0)) - total_venta
        elif metodo_pago != "fiado":
            sesion_caja.total_ventas_digital = max(
                Decimal("0.00"),
                Decimal(str(sesion_caja.total_ventas_digital or 0)) - total_venta,
            )

    mov_caja = models.MovimientoCaja(
        empresa_id=empresa_id,
        sesion_caja_id=sesion_caja.id if sesion_caja else None,
        usuario_id=current_user.id,
        usuario_nombre_snapshot=actor_nombre,
        tipo="anulacion_venta",
        categoria="anulacion",
        metodo_pago=metodo_pago,
        monto=total_venta,
        concepto=f"Anulación venta #{str(venta.id)[:8]}: {motivo}",
        referencia_venta_id=venta.id,
    )
    db.add(mov_caja)

    registrar_auditoria(
        db=db,
        accion="VENTA_ANULADA",
        empresa_id=empresa_id,
        usuario_id=current_user.id,
        actor_email=current_user.email,
        entidad="venta",
        entidad_id=str(venta.id),
        detalle=f"Venta #{str(venta.id)[:8]} anulada por ${float(total_venta):.2f}. Motivo: {motivo}",
    )

    db.commit()
    db.refresh(venta)
    return {
        "mensaje": "Venta anulada correctamente y existencias restauradas al inventario",
        "venta_id": str(venta.id),
        "estado": venta.estado,
        "motivo_anulacion": venta.motivo_anulacion,
        "total_revertido": float(venta.total),
    }


def obtener_ventas_empresa(
    empresa_id: UUID,
    db: Session,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
) -> list:
    if not db.query(models.Empresa).filter(
        models.Empresa.id == empresa_id,
        models.Empresa.is_active.is_(True),
    ).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada",
        )

    ahora = datetime.now(timezone.utc)
    inicio = fecha_inicio or (ahora - timedelta(days=30))
    fin    = fecha_fin   or ahora

    return (
        db.query(models.Venta)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.fecha_venta >= inicio,
            models.Venta.fecha_venta <= fin,
        )
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto)
        )
        .order_by(models.Venta.fecha_venta.desc())
        .all()
    )


def obtener_actividad_ventas(
    admin_user: models.Usuario,
    db: Session,
    fecha: Optional[str] = None,
    usuario_id: Optional[UUID] = None,
) -> list[models.Venta]:
    """
    Retorna la actividad de ventas de un día comercial en Colombia (America/Bogota).
    Usa intervalo semiabierto [inicio, fin) y orden determinista (fecha_venta ASC, id ASC).
    Valida pertenencia multi-tenant estricta si se filtra por usuario_id.
    """
    if not fecha:
        fecha_dt = datetime.now(COLOMBIA_TZ).date()
    else:
        try:
            fecha_dt = date.fromisoformat(fecha)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de fecha inválido. Use YYYY-MM-DD",
            )

    inicio = datetime.combine(fecha_dt, time.min, tzinfo=COLOMBIA_TZ)
    fin = inicio + timedelta(days=1)

    if usuario_id:
        vendedor = (
            db.query(models.Usuario)
            .filter(
                models.Usuario.id == usuario_id,
                models.Usuario.empresa_id == admin_user.empresa_id,
            )
            .first()
        )
        if not vendedor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendedor no encontrado en esta empresa",
            )

    query = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto)
        )
        .filter(
            models.Venta.empresa_id == admin_user.empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.fecha_venta >= inicio,
            models.Venta.fecha_venta < fin,
        )
    )

    if usuario_id:
        query = query.filter(models.Venta.usuario_id == usuario_id)

    return query.order_by(models.Venta.fecha_venta.asc(), models.Venta.id.asc()).all()
