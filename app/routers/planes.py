from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_admin
from app.services import entitlement_service
from app.services.audit_service import registrar_auditoria

router = APIRouter(prefix="/planes", tags=["Planes Comerciales y Suscripción"])


class CambiarPlanTiendaRequest(BaseModel):
    codigo_plan: Optional[Literal["basic", "standard", "pro"]] = None
    plan_codigo: Optional[Literal["basic", "standard", "pro"]] = None

    def obtener_codigo(self) -> str:
        cod = self.codigo_plan or self.plan_codigo
        if not cod:
            raise ValueError("Debes indicar codigo_plan o plan_codigo")
        return cod


@router.get("")
def listar_planes_comerciales(db: Session = Depends(get_db)):
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
            "max_ventas_mes": p.max_ventas_mensuales,
            "max_comprobantes_qr": p.max_comprobantes_qr,
            "acceso_simulador": p.acceso_simulador,
            "tiene_simulador": p.acceso_simulador,
            "acceso_reportes_avanzados": p.acceso_reportes_avanzados,
            "acceso_alertas_inteligentes": p.acceso_alertas_inteligentes,
            "acceso_exportacion_excel": p.acceso_exportacion_excel,
            "tiene_exportacion_excel": p.acceso_exportacion_excel,
            "tiene_ia_voz": p.codigo == "pro",
            "soporte_prioritario": p.soporte_prioritario,
            "tiene_soporte_prioritario": p.soporte_prioritario,
        }
        for p in planes
    ]


@router.get("/mi-suscripcion")
def obtener_mi_suscripcion(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    return entitlement_service.obtener_resumen_suscripcion(current_user.empresa_id, db)


@router.post("/cambiar")
def cambiar_plan_tienda(
    data: CambiarPlanTiendaRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    """
    Cambia el plan comercial de la tienda (Gratis / Standard / Pro).
    Cumple la regla de Sección 15: actualiza los permisos sin borrar ni bloquear
    la información histórica ni el inventario existente.
    """
    empresa = db.query(models.Empresa).filter(models.Empresa.id == current_user.empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")

    codigo_destino = data.obtener_codigo()
    plan_anterior = empresa.plan.value if hasattr(empresa.plan, "value") else str(empresa.plan)
    empresa.plan = models.PlanEmpresa(codigo_destino)

    registrar_auditoria(
        db=db,
        accion="CAMBIO_PLAN_TIENDA",
        empresa_id=empresa.id,
        usuario_id=current_user.id,
        actor_email=current_user.email,
        entidad="empresa",
        entidad_id=str(empresa.id),
        detalle=f"Cambio de plan comercial: {plan_anterior} -> {codigo_destino} (datos existentes intactos)",
    )
    db.commit()
    db.refresh(empresa)

    return {
        "mensaje": f"Plan actualizado exitosamente a {codigo_destino.upper()}. Tus datos existentes permanecen intactos.",
        "plan_anterior": plan_anterior,
        "plan_nuevo": codigo_destino,
        "suscripcion": entitlement_service.obtener_resumen_suscripcion(empresa.id, db),
    }
