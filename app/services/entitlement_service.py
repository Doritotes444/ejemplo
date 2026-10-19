"""Servicio centralizado de Entitlements y suscripciones para Tiendapp (Gestión Neiva).
Fuente única de verdad para el cálculo de estado del trial (15 días) y los 3 planes comerciales configurables:
- Gratis (basic)
- Standard (standard / medium)
- Pro (pro / premium)
"""

import math
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app import models


DURACION_TRIAL_DIAS = 15

DEFAULT_PLANES = [
    {
        "codigo": "basic",
        "nombre": "Gratis",
        "descripcion": "Ideal para empezar a digitalizar tu tienda de barrio sin costo.",
        "precio_mensual_cop": Decimal("0.00"),
        "max_usuarios": 4,
        "max_cajeros": 3,
        "max_productos": 100,
        "max_ventas_mensuales": 500,
        "max_comprobantes_qr": 30,
        "acceso_simulador": False,
        "acceso_reportes_avanzados": False,
        "acceso_alertas_inteligentes": True,
        "acceso_exportacion_excel": False,
        "soporte_prioritario": False,
    },
    {
        "codigo": "standard",
        "nombre": "Standard",
        "descripcion": "Para tiendas en crecimiento con mayor catálogo, simulador y reportes financieros.",
        "precio_mensual_cop": Decimal("39900.00"),
        "max_usuarios": 10,
        "max_cajeros": 8,
        "max_productos": 1500,
        "max_ventas_mensuales": 5000,
        "max_comprobantes_qr": 500,
        "acceso_simulador": True,
        "acceso_reportes_avanzados": True,
        "acceso_alertas_inteligentes": True,
        "acceso_exportacion_excel": True,
        "soporte_prioritario": False,
    },
    {
        "codigo": "pro",
        "nombre": "Pro",
        "descripcion": "Operación ilimitada, múltiples cajeros, bóveda QR extendida y soporte prioritario.",
        "precio_mensual_cop": Decimal("79900.00"),
        "max_usuarios": 9999,
        "max_cajeros": 9999,
        "max_productos": 99999,
        "max_ventas_mensuales": 999999,
        "max_comprobantes_qr": 99999,
        "acceso_simulador": True,
        "acceso_reportes_avanzados": True,
        "acceso_alertas_inteligentes": True,
        "acceso_exportacion_excel": True,
        "soporte_prioritario": True,
    },
]


def normalizar_codigo_plan(plan_val: Any) -> str:
    raw = plan_val.value if hasattr(plan_val, "value") else str(plan_val or "basic")
    raw = raw.lower().strip()
    if raw in ("medium", "standard"):
        return "standard"
    if raw in ("pro", "premium"):
        return "pro"
    return "basic"


def asegurar_planes_en_bd(db: Session) -> list[models.PlanConfig]:
    """Garantiza que los 3 planes comerciales existan en la tabla planes_config."""
    existentes = {p.codigo: p for p in db.query(models.PlanConfig).all()}
    creados = False
    for cfg in DEFAULT_PLANES:
        if cfg["codigo"] not in existentes:
            nuevo = models.PlanConfig(**cfg, is_active=True)
            db.add(nuevo)
            creados = True
    if creados:
        db.commit()
    return (
        db.query(models.PlanConfig)
        .filter(models.PlanConfig.is_active.is_(True))
        .order_by(models.PlanConfig.precio_mensual_cop.asc())
        .all()
    )


def obtener_config_plan(plan_val: Any, db: Session) -> models.PlanConfig:
    planes = asegurar_planes_en_bd(db)
    codigo = normalizar_codigo_plan(plan_val)
    for p in planes:
        if p.codigo == codigo:
            return p
    return planes[0]


def inicializar_trial(empresa: models.Empresa) -> None:
    """Inicializa la prueba gratuita de 15 días en UTC una sola vez por empresa.
    
    No reinicia el trial si la empresa ya contaba con uno asignado.
    """
    if empresa.trial_expires_at is None:
        empresa.trial_expires_at = datetime.now(timezone.utc) + timedelta(days=DURACION_TRIAL_DIAS)


def calcular_dias_trial_restantes(empresa: models.Empresa) -> int | None:
    """Calcula los días calendario restantes del período de prueba en UTC."""
    if not empresa or empresa.trial_expires_at is None:
        return None
    trial_ts = empresa.trial_expires_at
    if trial_ts.tzinfo is None:
        trial_ts = trial_ts.replace(tzinfo=timezone.utc)
    delta = trial_ts - datetime.now(timezone.utc)
    segundos_restantes = delta.total_seconds()
    if segundos_restantes <= 0:
        return 0
    return math.ceil(segundos_restantes / 86400)


def verificar_acceso_pro(empresa: models.Empresa | None) -> tuple[bool, str, dict[str, Any]]:
    """Verifica si la empresa cuenta con derecho de uso (entitlement) para funcionalidades avanzadas.
    
    Aplica principio Fail-Closed: deniega el acceso si la empresa es nula o inactiva.
    """
    if not empresa or not empresa.is_active:
        return False, "INACTIVE", {"motivo": "EMPRESA_INACTIVA"}

    # 1. Si la empresa cuenta con plan Standard o Pro pagado
    planes_pagos = {
        models.PlanEmpresa.STANDARD,
        models.PlanEmpresa.PRO,
        models.PlanEmpresa.MEDIUM,
        models.PlanEmpresa.PREMIUM,
    }
    if empresa.plan in planes_pagos:
        return True, "ACTIVE", {
            "plan": empresa.plan.value if hasattr(empresa.plan, "value") else str(empresa.plan),
            "plan_normalizado": normalizar_codigo_plan(empresa.plan),
            "dias_trial_restantes": None,
        }

    # 2. Si cuenta con plan Básico/Gratis, validar vigencia de la prueba gratuita de 15 días
    trial_ts = empresa.trial_expires_at
    if trial_ts is not None:
        if trial_ts.tzinfo is None:
            trial_ts = trial_ts.replace(tzinfo=timezone.utc)
        now_utc = datetime.now(timezone.utc)
        if now_utc < trial_ts:
            dias_restantes = calcular_dias_trial_restantes(empresa)
            return True, "TRIALING", {
                "plan": "basic",
                "plan_normalizado": "basic",
                "trial_expires_at": trial_ts.isoformat(),
                "dias_trial_restantes": dias_restantes,
            }

    # 3. Trial expirado
    return False, "EXPIRED", {
        "plan": "basic",
        "plan_normalizado": "basic",
        "motivo": "TRIAL_EXPIRED",
        "dias_trial_restantes": 0,
    }


def verificar_cupo_productos(empresa_id: UUID, db: Session) -> None:
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        return
    cfg = obtener_config_plan(empresa.plan, db)
    total_activos = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
        )
        .count()
    )
    if total_activos >= cfg.max_productos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Has alcanzado el límite de {cfg.max_productos} productos de tu plan {cfg.nombre}. Actualiza tu plan para registrar más productos sin perder tu información actual.",
        )


def obtener_resumen_suscripcion(empresa_id: UUID, db: Session) -> dict:
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    planes = asegurar_planes_en_bd(db)
    cfg_actual = obtener_config_plan(empresa.plan, db)
    tiene_acceso_avanzado, estado_trial, meta_trial = verificar_acceso_pro(empresa)

    cajeros_activos = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.empresa_id == empresa_id,
            models.Usuario.rol == models.RolUsuario.TENDERO,
            models.Usuario.is_active.is_(True),
        )
        .count()
    )
    productos_activos = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
        )
        .count()
    )
    inicio_mes = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    ventas_mes = (
        db.query(models.Venta)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.fecha_venta >= inicio_mes,
        )
        .count()
    )
    comprobantes_mes = (
        db.query(models.ComprobantePago)
        .filter(
            models.ComprobantePago.empresa_id == empresa_id,
            models.ComprobantePago.is_active.is_(True),
            models.ComprobantePago.created_at >= inicio_mes,
        )
        .count()
    )

    return {
        "empresa_id": str(empresa.id),
        "nombre_comercial": empresa.nombre_comercial,
        "plan_actual": {
            "codigo": cfg_actual.codigo,
            "codigo_db": empresa.plan.value if hasattr(empresa.plan, "value") else str(empresa.plan),
            "nombre": cfg_actual.nombre,
            "descripcion": cfg_actual.descripcion,
            "precio_mensual_cop": float(cfg_actual.precio_mensual_cop),
            "estado_suscripcion": estado_trial,
            "dias_trial_restantes": meta_trial.get("dias_trial_restantes"),
            "tiene_acceso_avanzado": tiene_acceso_avanzado,
            "limites": {
                "max_usuarios": cfg_actual.max_usuarios,
                "max_cajeros": cfg_actual.max_cajeros,
                "max_productos": cfg_actual.max_productos,
                "max_ventas_mensuales": cfg_actual.max_ventas_mensuales,
                "max_comprobantes_qr": cfg_actual.max_comprobantes_qr,
                "acceso_simulador": cfg_actual.acceso_simulador or tiene_acceso_avanzado,
                "acceso_reportes_avanzados": cfg_actual.acceso_reportes_avanzados or tiene_acceso_avanzado,
                "acceso_alertas_inteligentes": cfg_actual.acceso_alertas_inteligentes,
                "acceso_exportacion_excel": cfg_actual.acceso_exportacion_excel or tiene_acceso_avanzado,
                "soporte_prioritario": cfg_actual.soporte_prioritario,
            },
        },
        "uso_actual": {
            "cajeros_activos": cajeros_activos,
            "productos_activos": productos_activos,
            "ventas_mes_actual": ventas_mes,
            "comprobantes_qr_mes_actual": comprobantes_mes,
        },
        "catalogo_planes": [
            {
                "id": str(p.id),
                "codigo": p.codigo,
                "nombre": p.nombre,
                "descripcion": p.descripcion,
                "precio_mensual_cop": float(p.precio_mensual_cop),
                "max_usuarios": p.max_usuarios,
                "max_cajeros": p.max_cajeros,
                "max_productos": p.max_productos,
                "max_ventas_mensuales": p.max_ventas_mensuales,
                "max_comprobantes_qr": p.max_comprobantes_qr,
                "acceso_simulador": p.acceso_simulador,
                "acceso_reportes_avanzados": p.acceso_reportes_avanzados,
                "acceso_alertas_inteligentes": p.acceso_alertas_inteligentes,
                "acceso_exportacion_excel": p.acceso_exportacion_excel,
                "soporte_prioritario": p.soporte_prioritario,
            }
            for p in planes
        ],
    }
