import uuid
from datetime import datetime, timezone, timedelta
import pytest
from app import models
from app.services import entitlement_service


def test_inicializar_trial_15_dias():
    empresa = models.Empresa(
        id=uuid.uuid4(),
        nombre_comercial="Tienda Test",
        nit_o_cedula="900123456-1",
        plan=models.PlanEmpresa.BASIC,
        trial_expires_at=None,
        is_active=True,
    )
    entitlement_service.inicializar_trial(empresa)
    assert empresa.trial_expires_at is not None
    now = datetime.now(timezone.utc)
    delta = empresa.trial_expires_at - now
    # Debe ser de aproximadamente 15 días (entre 14 y 15 días)
    assert 14 <= delta.days <= 15


def test_inicializar_trial_no_sobreescribe():
    fecha_existente = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    empresa = models.Empresa(
        id=uuid.uuid4(),
        nombre_comercial="Tienda Test",
        nit_o_cedula="900123456-2",
        plan=models.PlanEmpresa.BASIC,
        trial_expires_at=fecha_existente,
        is_active=True,
    )
    entitlement_service.inicializar_trial(empresa)
    assert empresa.trial_expires_at == fecha_existente


def test_verificar_acceso_pro_activo():
    empresa = models.Empresa(
        id=uuid.uuid4(),
        nombre_comercial="Tienda Pro",
        nit_o_cedula="900123456-3",
        plan=models.PlanEmpresa.PRO,
        trial_expires_at=None,
        is_active=True,
    )
    acceso, estado, meta = entitlement_service.verificar_acceso_pro(empresa)
    assert acceso is True
    assert estado == "ACTIVE"


def test_verificar_acceso_trial_vigente():
    empresa = models.Empresa(
        id=uuid.uuid4(),
        nombre_comercial="Tienda Trial",
        nit_o_cedula="900123456-4",
        plan=models.PlanEmpresa.BASIC,
        trial_expires_at=datetime.now(timezone.utc) + timedelta(days=10),
        is_active=True,
    )
    acceso, estado, meta = entitlement_service.verificar_acceso_pro(empresa)
    assert acceso is True
    assert estado == "TRIALING"
    assert meta["dias_trial_restantes"] == 10


def test_verificar_acceso_trial_expirado():
    empresa = models.Empresa(
        id=uuid.uuid4(),
        nombre_comercial="Tienda Vencida",
        nit_o_cedula="900123456-5",
        plan=models.PlanEmpresa.BASIC,
        trial_expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        is_active=True,
    )
    acceso, estado, meta = entitlement_service.verificar_acceso_pro(empresa)
    assert acceso is False
    assert estado == "EXPIRED"
    assert meta["dias_trial_restantes"] == 0


def test_verificar_acceso_fail_closed():
    # Empresa inactiva o None debe denegar acceso por principio fail-closed
    assert entitlement_service.verificar_acceso_pro(None)[0] is False

    empresa_inactiva = models.Empresa(
        id=uuid.uuid4(),
        nombre_comercial="Inactiva",
        nit_o_cedula="900123456-6",
        plan=models.PlanEmpresa.PRO,
        is_active=False,
    )
    assert entitlement_service.verificar_acceso_pro(empresa_inactiva)[0] is False
