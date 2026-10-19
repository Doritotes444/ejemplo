from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user_admin
from app.schemas.dashboard import DashboardRespuesta

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/{empresa_id}", response_model=DashboardRespuesta)
def resumen_dashboard(
    empresa_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    if current_user.empresa_id != empresa_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso no autorizado",
        )

    hoy = date.today()
    ahora_utc = datetime.now(timezone.utc)
    hoy_inicio = datetime.combine(hoy, datetime.min.time()).replace(tzinfo=timezone.utc)
    semana_inicio = ahora_utc - timedelta(days=7)
    mes_inicio = ahora_utc - timedelta(days=30)

    # --- Métricas básicas hoy (excluyendo anuladas) ---
    ventas_hoy = (
        db.query(func.count(models.Venta.id))
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.fecha_venta >= hoy_inicio,
        )
        .scalar()
        or 0
    )

    ingresos_hoy = float(
        db.query(func.coalesce(func.sum(models.Venta.total), 0))
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.fecha_venta >= hoy_inicio,
        )
        .scalar()
        or 0
    )

    ingresos_semana = float(
        db.query(func.coalesce(func.sum(models.Venta.total), 0))
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.fecha_venta >= semana_inicio,
        )
        .scalar()
        or 0
    )

    ingresos_mes = float(
        db.query(func.coalesce(func.sum(models.Venta.total), 0))
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.fecha_venta >= mes_inicio,
        )
        .scalar()
        or 0
    )

    fiado_mes = float(
        db.query(func.coalesce(func.sum(models.Venta.total), 0))
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.metodo_pago == "fiado",
            models.Venta.fecha_venta >= mes_inicio,
        )
        .scalar()
        or 0
    )
    cobros_mes = max(0.0, ingresos_mes - fiado_mes)

    # Costo de mercancía vendida (COGS) de los últimos 30 días
    cogs_mes = float(
        db.query(
            func.coalesce(
                func.sum(
                    models.DetalleVenta.cantidad
                    * func.coalesce(models.DetalleVenta.costo_unitario_snapshot, models.Producto.precio_costo)
                ),
                0,
            )
        )
        .join(models.Venta, models.Venta.id == models.DetalleVenta.venta_id)
        .join(models.Producto, models.Producto.id == models.DetalleVenta.producto_id)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.fecha_venta >= mes_inicio,
        )
        .scalar()
        or 0
    )

    # Ingresos extra y egresos operativos de caja en los últimos 30 días
    ingresos_extra_mes = float(
        db.query(func.coalesce(func.sum(models.MovimientoCaja.monto), 0))
        .filter(
            models.MovimientoCaja.empresa_id == empresa_id,
            models.MovimientoCaja.is_active.is_(True),
            models.MovimientoCaja.tipo == "ingreso",
            models.MovimientoCaja.fecha >= mes_inicio,
        )
        .scalar()
        or 0
    )

    egresos_mes = float(
        db.query(func.coalesce(func.sum(models.MovimientoCaja.monto), 0))
        .filter(
            models.MovimientoCaja.empresa_id == empresa_id,
            models.MovimientoCaja.is_active.is_(True),
            models.MovimientoCaja.tipo == "egreso",
            models.MovimientoCaja.fecha >= mes_inicio,
        )
        .scalar()
        or 0
    )

    utilidad_bruta_mes = round(ingresos_mes - cogs_mes, 2)
    margen_bruto_pct = round((utilidad_bruta_mes / ingresos_mes) * 100.0, 1) if ingresos_mes > 0 else 0.0
    utilidad_neta_mes = round(utilidad_bruta_mes + ingresos_extra_mes - egresos_mes, 2)

    if utilidad_neta_mes > 0:
        estado_resultado = "GANANDO"
    elif utilidad_neta_mes < 0:
        estado_resultado = "PERDIENDO"
    else:
        estado_resultado = "PUNTO_EQUILIBRIO"

    total_productos = (
        db.query(func.count(models.Producto.id))
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
        )
        .scalar()
        or 0
    )

    stock_bajo = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
            models.Producto.cantidad_actual <= models.Producto.stock_minimo,
        )
        .order_by(models.Producto.cantidad_actual.asc())
        .all()
    )

    # --- Top productos más vendidos y más rentables ---
    top_rows = (
        db.query(
            models.Producto.id,
            models.Producto.nombre,
            models.Producto.precio_venta,
            models.Producto.precio_costo,
            func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).label("total_vendido"),
            func.coalesce(func.sum(models.DetalleVenta.subtotal), 0).label("ingresos"),
        )
        .join(models.DetalleVenta, models.DetalleVenta.producto_id == models.Producto.id)
        .join(models.Venta, models.Venta.id == models.DetalleVenta.venta_id)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
            models.Venta.estado != "anulada",
        )
        .group_by(
            models.Producto.id,
            models.Producto.nombre,
            models.Producto.precio_venta,
            models.Producto.precio_costo,
        )
        .order_by(func.sum(models.DetalleVenta.cantidad).desc())
        .all()
    )

    top_vendidos = [
        {
            "nombre": row.nombre,
            "total_vendido": float(row.total_vendido),
            "ingresos": float(row.ingresos),
            "utilidad": round(float(row.total_vendido) * float(row.precio_venta - row.precio_costo), 2),
        }
        for row in top_rows[:5]
    ]

    mas_rentables = sorted(
        [
            {
                "id": str(row.id),
                "nombre": row.nombre,
                "total_vendido": float(row.total_vendido),
                "ingresos": float(row.ingresos),
                "margen_unitario": float(row.precio_venta - row.precio_costo),
                "utilidad_total": round(float(row.total_vendido) * float(row.precio_venta - row.precio_costo), 2),
            }
            for row in top_rows
        ],
        key=lambda x: x["utilidad_total"],
        reverse=True,
    )[:5]

    ids_con_venta = {row.id for row in top_rows}
    todos_productos = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
            models.Producto.cantidad_actual > 0,
        )
        .all()
    )
    sin_movimiento = [
        {
            "id": str(p.id),
            "nombre": p.nombre,
            "cantidad": float(p.cantidad_actual),
            "capital_inmovilizado": round(float(p.cantidad_actual) * float(p.precio_costo), 2),
        }
        for p in todos_productos
        if p.id not in ids_con_venta
    ][:8]

    # --- Alertas de vencimiento (próximos 15 días) ---
    limite_vencimiento = hoy + timedelta(days=15)
    proximos_a_vencer = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
            models.Producto.fecha_vencimiento.isnot(None),
            models.Producto.fecha_vencimiento <= limite_vencimiento,
        )
        .order_by(models.Producto.fecha_vencimiento)
        .all()
    )

    # --- Estado de Caja ---
    sesion_caja = (
        db.query(models.SesionCaja)
        .filter(
            models.SesionCaja.empresa_id == empresa_id,
            models.SesionCaja.estado == "abierta",
            models.SesionCaja.is_active.is_(True),
        )
        .first()
    )
    estado_caja = {
        "caja_abierta": sesion_caja is not None,
        "sesion_id": str(sesion_caja.id) if sesion_caja else None,
        "monto_inicial": float(sesion_caja.monto_inicial or 0) if sesion_caja else 0.0,
        "saldo_esperado_efectivo": float(sesion_caja.saldo_esperado_efectivo or 0) if sesion_caja else 0.0,
        "total_ventas_efectivo": float(sesion_caja.total_ventas_efectivo or 0) if sesion_caja else 0.0,
        "total_ventas_digital": float(sesion_caja.total_ventas_digital or 0) if sesion_caja else 0.0,
        "total_ingresos_extra": float(sesion_caja.total_ingresos_extra or 0) if sesion_caja else 0.0,
        "total_egresos": float(sesion_caja.total_egresos or 0) if sesion_caja else 0.0,
    }

    # --- Trial info ---
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    dias_trial_restantes = None
    if empresa and empresa.trial_expires_at:
        trial_dt = empresa.trial_expires_at
        if trial_dt.tzinfo is None:
            trial_dt = trial_dt.replace(tzinfo=timezone.utc)
        delta = trial_dt - ahora_utc
        dias_trial_restantes = max(0, delta.days)

    return {
        "ventas_hoy": ventas_hoy,
        "ingresos_hoy": ingresos_hoy,
        "total_productos": total_productos,
        "stock_bajo": [
            {
                "id": str(p.id),
                "nombre": p.nombre,
                "cantidad": float(p.cantidad_actual),
                "stock_minimo": float(p.stock_minimo if p.stock_minimo is not None else 5.0),
                "foto_url": p.foto_url,
            }
            for p in stock_bajo
        ],
        "top_productos": top_vendidos,
        "alertas_vencimiento": [
            {
                "id": str(p.id),
                "nombre": p.nombre,
                "fecha_vencimiento": p.fecha_vencimiento,
                "dias_restantes": (p.fecha_vencimiento - hoy).days,
            }
            for p in proximos_a_vencer
        ],
        "dias_trial_restantes": dias_trial_restantes,
        "plan": empresa.plan.value if empresa else "basic",
        "finanzas_360": {
            "ventas_hoy": ingresos_hoy,
            "ventas_semana": ingresos_semana,
            "ventas_mes": ingresos_mes,
            "cobros_efectivo_digital_mes": cobros_mes,
            "cuentas_por_cobrar_fiado_mes": fiado_mes,
            "cogs_mes": round(cogs_mes, 2),
            "utilidad_bruta_mes": utilidad_bruta_mes,
            "margen_bruto_pct": margen_bruto_pct,
            "ingresos_extra_caja_mes": round(ingresos_extra_mes, 2),
            "egresos_caja_mes": round(egresos_mes, 2),
            "utilidad_neta_estimada_mes": utilidad_neta_mes,
            "estado_resultado": estado_resultado,
        },
        "productos_mas_rentables": mas_rentables,
        "productos_sin_movimiento": sin_movimiento,
        "estado_caja": estado_caja,
    }
