"""Servicio centralizado de Entitlements y suscripciones para Gestión Neiva.
Fuente única de verdad para el cálculo de estado del trial (15 días) y acceso a funciones Pro.
"""

import math
from datetime import datetime, timezone, timedelta
from typing import Any
from app import models


DURACION_TRIAL_DIAS = 15


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
    """Verifica si la empresa cuenta con derecho de uso (entitlement) para funcionalidades Pro.
    
    Aplica principio Fail-Closed: deniega el acceso si la empresa es nula o inactiva.
    
    Returns:
        tuple (tiene_acceso: bool, estado: str, metadatos: dict)
        Estados posibles:
        - "ACTIVE": Plan Pro contratado y vigente
        - "TRIALING": Período de prueba gratuito de 15 días activo
        - "EXPIRED": Período de prueba vencido sin suscripción Pro
        - "INACTIVE": Empresa inactiva o no encontrada
    """
    if not empresa or not empresa.is_active:
        return False, "INACTIVE", {"motivo": "EMPRESA_INACTIVA"}

    # 1. Si la empresa cuenta con plan Pro o superior pagado
    planes_pro = {
        models.PlanEmpresa.PRO,
        models.PlanEmpresa.MEDIUM,
        models.PlanEmpresa.PREMIUM,
    }
    if empresa.plan in planes_pro:
        return True, "ACTIVE", {
            "plan": empresa.plan.value,
            "dias_trial_restantes": None,
        }

    # 2. Si cuenta con plan Básico, validar vigencia de la prueba gratuita de 15 días
    trial_ts = empresa.trial_expires_at
    if trial_ts is not None:
        if trial_ts.tzinfo is None:
            trial_ts = trial_ts.replace(tzinfo=timezone.utc)
        now_utc = datetime.now(timezone.utc)
        if now_utc < trial_ts:
            dias_restantes = calcular_dias_trial_restantes(empresa)
            return True, "TRIALING", {
                "plan": "basic",
                "trial_expires_at": trial_ts.isoformat(),
                "dias_trial_restantes": dias_restantes,
            }

    # 3. Trial expirado
    return False, "EXPIRED", {
        "plan": "basic",
        "motivo": "TRIAL_EXPIRED",
        "dias_trial_restantes": 0,
    }
