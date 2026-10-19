import os
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.soporte import (
    ActualizarEstado,
    ActualizarPlan,
    ActualizarTrial,
    EmpresaAdminOut,
    TicketListOut,
    TicketResponder,
)
from app.services import entitlement_service
from app.services.audit_service import registrar_auditoria

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])


class ActualizarConfigPlanRequest(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio_mensual_cop: Optional[Decimal] = None
    max_usuarios: Optional[int] = None
    max_cajeros: Optional[int] = None
    max_productos: Optional[int] = None
    max_ventas_mensuales: Optional[int] = None
    max_comprobantes_qr: Optional[int] = None
    acceso_simulador: Optional[bool] = None
    acceso_reportes_avanzados: Optional[bool] = None
    acceso_alertas_inteligentes: Optional[bool] = None
    acceso_exportacion_excel: Optional[bool] = None
    soporte_prioritario: Optional[bool] = None


def _check_superadmin(
    authorization: Optional[str] = Header(default=None),
    x_superadmin_key: Optional[str] = Header(default=None, alias="x-superadmin-key"),
    db: Session = Depends(get_db),
):
    """
    Permite acceso de superadmin mediante:
    1. Sesión JWT normal autenticada con usuario.es_superadmin == True (Login único de Tiendapp 2.0).
    2. Cabecera x-superadmin-key (para scripts de automatización y tests backend).
    Si ninguna credencial válida es provista, retorna 403 Forbidden.
    """
    key = os.getenv("SUPERADMIN_KEY")
    if x_superadmin_key and key and x_superadmin_key == key:
        return None

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        try:
            from app.services.auth_service import ALGORITHM, SECRET_KEY
            import jwt
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                u_uuid = UUID(user_id) if not isinstance(user_id, UUID) else user_id
                user = db.query(models.Usuario).filter(
                    models.Usuario.id == u_uuid,
                    models.Usuario.is_active.is_(True),
                ).first()
                if user and getattr(user, "es_superadmin", False):
                    return user
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acceso restringido al equipo de Tiendapp",
    )


@router.get("/metricas-globales")
def obtener_metricas_globales(
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    entitlement_service.asegurar_planes_en_bd(db)
    total_empresas = db.query(func.count(models.Empresa.id)).scalar() or 0
    empresas_activas = (
        db.query(func.count(models.Empresa.id))
        .filter(models.Empresa.is_active.is_(True))
        .scalar()
        or 0
    )
    total_usuarios = db.query(func.count(models.Usuario.id)).scalar() or 0
    total_productos = (
        db.query(func.count(models.Producto.id))
        .filter(models.Producto.is_active.is_(True))
        .scalar()
        or 0
    )
    total_ventas_count = (
        db.query(func.count(models.Venta.id))
        .filter(models.Venta.estado != "anulada")
        .scalar()
        or 0
    )
    volumen_ventas_global = float(
        db.query(func.coalesce(func.sum(models.Venta.total), 0))
        .filter(models.Venta.estado != "anulada")
        .scalar()
        or 0
    )
    tickets_abiertos = (
        db.query(func.count(models.SoporteTicket.id))
        .filter(
            models.SoporteTicket.is_active.is_(True),
            models.SoporteTicket.estado == models.EstadoTicket.ABIERTO,
        )
        .scalar()
        or 0
    )

    por_plan_rows = (
        db.query(models.Empresa.plan, func.count(models.Empresa.id))
        .group_by(models.Empresa.plan)
        .all()
    )
    distribucion_planes = {"basic": 0, "standard": 0, "pro": 0}
    for plan_val, cnt in por_plan_rows:
        norm = entitlement_service.normalizar_codigo_plan(plan_val)
        distribucion_planes[norm] = distribucion_planes.get(norm, 0) + int(cnt)

    return {
        "total_empresas": total_empresas,
        "empresas_activas": empresas_activas,
        "total_usuarios": total_usuarios,
        "total_productos": total_productos,
        "total_ventas_registradas": total_ventas_count,
        "volumen_ventas_global_cop": volumen_ventas_global,
        "tickets_abiertos": tickets_abiertos,
        "distribucion_planes": distribucion_planes,
    }


@router.get("/planes")
def listar_planes_config(
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    planes = entitlement_service.asegurar_planes_en_bd(db)
    return [
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
    ]


@router.put("/planes/{codigo}")
def actualizar_plan_config(
    codigo: str,
    data: ActualizarConfigPlanRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    entitlement_service.asegurar_planes_en_bd(db)
    plan_cfg = (
        db.query(models.PlanConfig)
        .filter(models.PlanConfig.codigo == codigo.lower().strip())
        .first()
    )
    if not plan_cfg:
        raise HTTPException(status_code=404, detail=f"Plan '{codigo}' no encontrado")

    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(plan_cfg, campo, valor)

    registrar_auditoria(
        db=db,
        accion="SUPERADMIN_CONFIG_PLAN",
        actor_email="superadmin",
        entidad="plan_config",
        entidad_id=plan_cfg.codigo,
        detalle=f"Configuración de plan {plan_cfg.nombre} actualizada",
    )
    db.commit()
    db.refresh(plan_cfg)
    return {
        "mensaje": f"Configuración del plan {plan_cfg.nombre} actualizada",
        "plan": {
            "codigo": plan_cfg.codigo,
            "nombre": plan_cfg.nombre,
            "precio_mensual_cop": float(plan_cfg.precio_mensual_cop),
            "max_usuarios": plan_cfg.max_usuarios,
            "max_cajeros": plan_cfg.max_cajeros,
            "max_productos": plan_cfg.max_productos,
            "max_ventas_mensuales": plan_cfg.max_ventas_mensuales,
            "max_comprobantes_qr": plan_cfg.max_comprobantes_qr,
            "acceso_simulador": plan_cfg.acceso_simulador,
            "acceso_reportes_avanzados": plan_cfg.acceso_reportes_avanzados,
            "acceso_alertas_inteligentes": plan_cfg.acceso_alertas_inteligentes,
            "acceso_exportacion_excel": plan_cfg.acceso_exportacion_excel,
            "soporte_prioritario": plan_cfg.soporte_prioritario,
        },
    }


@router.get("/auditoria")
def listar_auditoria_global(
    empresa_id: Optional[UUID] = Query(default=None),
    accion: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    query = db.query(models.AuditLog)
    if empresa_id:
        query = query.filter(models.AuditLog.empresa_id == empresa_id)
    if accion:
        query = query.filter(models.AuditLog.accion == accion)
    logs = query.order_by(models.AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(l.id),
            "empresa_id": str(l.empresa_id) if l.empresa_id else None,
            "usuario_id": str(l.usuario_id) if l.usuario_id else None,
            "actor_email": l.actor_email,
            "accion": l.accion,
            "entidad": l.entidad,
            "entidad_id": l.entidad_id,
            "detalle": l.detalle,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/empresas", response_model=list[EmpresaAdminOut])
def listar_empresas(
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    counts = dict(
        db.query(models.Usuario.empresa_id, func.count(models.Usuario.id))
        .group_by(models.Usuario.empresa_id)
        .all()
    )

    empresas = db.query(models.Empresa).order_by(models.Empresa.created_at.desc()).all()

    return [
        EmpresaAdminOut(
            id=e.id,
            nombre_comercial=e.nombre_comercial,
            nit_o_cedula=e.nit_o_cedula,
            plan=e.plan.value if e.plan else "basic",
            is_active=e.is_active,
            trial_expires_at=e.trial_expires_at,
            total_usuarios=counts.get(e.id, 0),
        )
        for e in empresas
    ]


@router.put("/empresas/{empresa_id}/trial")
def actualizar_trial(
    empresa_id: UUID,
    data: ActualizarTrial,
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    empresa.trial_expires_at = data.trial_expires_at
    registrar_auditoria(
        db=db,
        accion="SUPERADMIN_TRIAL_UPDATE",
        empresa_id=empresa.id,
        actor_email="superadmin",
        entidad="empresa",
        entidad_id=str(empresa.id),
        detalle=f"Trial actualizado a {data.trial_expires_at}",
    )
    db.commit()
    return {"mensaje": "Trial actualizado", "trial_expires_at": empresa.trial_expires_at}


@router.put("/empresas/{empresa_id}/status")
def actualizar_estado(
    empresa_id: UUID,
    data: ActualizarEstado,
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    empresa.is_active = data.is_active
    registrar_auditoria(
        db=db,
        accion="SUPERADMIN_EMPRESA_STATUS",
        empresa_id=empresa.id,
        actor_email="superadmin",
        entidad="empresa",
        entidad_id=str(empresa.id),
        detalle=f"Estado activo={data.is_active}",
    )
    db.commit()
    return {"mensaje": "Estado actualizado", "is_active": empresa.is_active}


@router.put("/empresas/{empresa_id}/plan")
def actualizar_plan(
    empresa_id: UUID,
    data: ActualizarPlan,
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    from app.models import PlanEmpresa
    try:
        nuevo_plan = PlanEmpresa(data.plan)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plan inválido. Valores permitidos: {[p.value for p in PlanEmpresa]}",
        )
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    plan_anterior = empresa.plan.value if empresa.plan else "basic"
    empresa.plan = nuevo_plan
    registrar_auditoria(
        db=db,
        accion="SUPERADMIN_CAMBIO_PLAN",
        empresa_id=empresa.id,
        actor_email="superadmin",
        entidad="empresa",
        entidad_id=str(empresa.id),
        detalle=f"Cambio de plan {plan_anterior} -> {nuevo_plan.value} (sin afectar datos existentes)",
    )
    db.commit()
    return {"mensaje": "Plan actualizado", "plan": empresa.plan.value}


@router.get("/tickets", response_model=list[TicketListOut])
def listar_todos_tickets(
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    return (
        db.query(models.SoporteTicket)
        .filter(models.SoporteTicket.is_active.is_(True))
        .order_by(models.SoporteTicket.updated_at.desc())
        .all()
    )


@router.delete("/empresas/{empresa_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_empresa(
    empresa_id: UUID,
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    db.delete(empresa)
    db.commit()


@router.post("/tickets/{ticket_id}/responder")
def responder_ticket(
    ticket_id: UUID,
    data: TicketResponder,
    db: Session = Depends(get_db),
    _: None = Depends(_check_superadmin),
):
    ticket = db.query(models.SoporteTicket).filter(
        models.SoporteTicket.id == ticket_id,
        models.SoporteTicket.is_active.is_(True),
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    mensaje = models.SoporteMensaje(
        ticket_id=ticket_id,
        remitente_rol=models.RemitenteRol.SUPERADMIN,
        remitente_email="soporte@gestionneiva.com",
        mensaje=data.mensaje,
    )
    ticket.estado = models.EstadoTicket.RESPONDIDO
    db.add(mensaje)
    db.commit()
    return {"mensaje": "Respuesta enviada"}
