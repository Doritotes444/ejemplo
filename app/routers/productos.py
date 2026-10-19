from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_admin
from app.schemas.producto import (
    InventarioAdminRespuesta,
    InventarioCajeroRespuesta,
    InventarioRespuesta,
    MovimientoInventarioCrear,
    ProductoActualizar,
    ProductoAdminOut,
    ProductoCajeroOut,
    ProductoCrear,
    ProductoRespuesta,
)
from app.services import producto_service

router = APIRouter(prefix="/productos", tags=["Productos"])


@router.post("", response_model=ProductoAdminOut, status_code=status.HTTP_201_CREATED)
def crear_producto(
    data: ProductoCrear,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    # empresa_id siempre viene del JWT, no del body — previene spoofing multi-tenant
    return producto_service.crear_producto(
        data.model_copy(update={"empresa_id": current_user.empresa_id}),
        db,
        usuario=current_user,
    )


@router.get("", response_model=InventarioAdminRespuesta | InventarioCajeroRespuesta)
def listar_productos(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    res = producto_service.obtener_productos_empresa(current_user.empresa_id, db)
    if current_user.rol == models.RolUsuario.ADMIN:
        return InventarioAdminRespuesta(
            tienda=res["tienda"],
            total_items=res["total_items"],
            inventario=[ProductoAdminOut.model_validate(p) for p in res["inventario"]],
        )
    return InventarioCajeroRespuesta(
        tienda=res["tienda"],
        total_items=res["total_items"],
        inventario=[ProductoCajeroOut.model_validate(p) for p in res["inventario"]],
    )


@router.get("/codigo/{codigo_barras}", response_model=ProductoAdminOut | ProductoCajeroOut)
def buscar_por_codigo_barras(
    codigo_barras: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    producto = producto_service.obtener_producto_por_codigo_barras(
        codigo_barras, current_user.empresa_id, db
    )
    if current_user.rol == models.RolUsuario.ADMIN:
        return ProductoAdminOut.model_validate(producto)
    return ProductoCajeroOut.model_validate(producto)


@router.get("/movimientos/historial")
def historial_movimientos(
    producto_id: Optional[UUID] = Query(default=None),
    tipo: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    return producto_service.listar_movimientos_inventario(
        empresa_id=current_user.empresa_id,
        db=db,
        producto_id=producto_id,
        tipo=tipo,
        limit=limit,
    )


@router.get("/alertas/inteligentes")
def alertas_inteligentes(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    return producto_service.obtener_alertas_inteligentes(
        empresa_id=current_user.empresa_id,
        db=db,
    )


@router.get("/{producto_id}", response_model=ProductoAdminOut | ProductoCajeroOut)
def obtener_producto(
    producto_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    producto = producto_service.obtener_producto_por_id(
        producto_id, current_user.empresa_id, db
    )
    if current_user.rol == models.RolUsuario.ADMIN:
        return ProductoAdminOut.model_validate(producto)
    return ProductoCajeroOut.model_validate(producto)


@router.post("/{producto_id}/movimiento")
def registrar_movimiento(
    producto_id: UUID,
    data: MovimientoInventarioCrear,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    res = producto_service.registrar_movimiento_inventario(
        producto_id=producto_id,
        empresa_id=current_user.empresa_id,
        data=data,
        usuario=current_user,
        db=db,
    )
    return {
        "mensaje": "Movimiento de inventario registrado",
        "idempotente": res["idempotente"],
        "stock_resultante": float(res["movimiento"].stock_nuevo),
        "producto": ProductoAdminOut.model_validate(res["producto"]),
        "movimiento": {
            "id": str(res["movimiento"].id),
            "tipo": res["movimiento"].tipo,
            "cantidad": float(res["movimiento"].cantidad),
            "stock_anterior": float(res["movimiento"].stock_anterior),
            "stock_nuevo": float(res["movimiento"].stock_nuevo),
            "motivo": res["movimiento"].motivo,
            "created_at": res["movimiento"].created_at.isoformat() if res["movimiento"].created_at else None,
        },
    }


@router.put("/{producto_id}", response_model=ProductoRespuesta)
def actualizar_producto(
    producto_id: UUID,
    data: ProductoActualizar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    return producto_service.actualizar_producto(
        producto_id, current_user.empresa_id, data, db, usuario=current_user
    )


@router.delete("/{producto_id}", status_code=status.HTTP_200_OK)
def eliminar_producto(
    producto_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    producto_service.eliminar_producto(producto_id, current_user.empresa_id, db)
    return {"mensaje": "Producto eliminado exitosamente"}


@router.post("/{producto_id}/imagen")
async def subir_imagen(
    producto_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    url = await producto_service.guardar_imagen_producto(
        producto_id, current_user.empresa_id, file, db
    )
    return {"mensaje": "Imagen subida exitosamente", "url_acceso": url}
