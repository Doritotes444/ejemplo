from typing import Any, Dict, List, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user
from app.routers.caja import MovimientoCajaRequest, registrar_movimiento_caja
from app.routers.comprobantes import CrearComprobanteRequest, registrar_comprobante
from app.schemas.producto import MovimientoInventarioCrear
from app.schemas.venta import VentaCrear
from app.services import producto_service, venta_service

router = APIRouter(prefix="/sync", tags=["Sincronización Offline e Idempotencia"])


class OperacionOfflineItem(BaseModel):
    client_operation_id: str
    tipo: Literal["venta", "movimiento_inventario", "movimiento_caja", "comprobante_qr"]
    payload: Dict[str, Any]


class LoteSyncRequest(BaseModel):
    operaciones: List[OperacionOfflineItem]


@router.post("/lote")
def sincronizar_lote_offline(
    data: LoteSyncRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    """
    Procesa en orden cronológico una cola de operaciones registradas sin conexión.
    Utiliza client_operation_id para garantizar idempotencia absoluta (evita ventas
    duplicadas o descuentos dobles de inventario) y reporta conflictos individuales
    sin abortar el resto del lote.
    """
    resultados = []
    sincronizadas = 0
    idempotentes = 0
    conflictos = 0

    for op in data.operaciones:
        try:
            payload_con_id = {**op.payload, "client_operation_id": op.client_operation_id}

            if op.tipo == "venta":
                venta_req = VentaCrear(**payload_con_id)
                res = venta_service.registrar_venta(
                    empresa_id=current_user.empresa_id,
                    data=venta_req,
                    current_user=current_user,
                    db=db,
                    commit=True,
                )
                if res.idempotente:
                    idempotentes += 1
                    estado_op = "IDEMPOTENTE"
                else:
                    sincronizadas += 1
                    estado_op = "SINCRONIZADO"
                resultados.append({
                    "client_operation_id": op.client_operation_id,
                    "tipo": op.tipo,
                    "estado": estado_op,
                    "server_id": str(res.venta_id),
                    "mensaje": res.mensaje,
                })

            elif op.tipo == "movimiento_inventario":
                producto_id = UUID(str(op.payload.get("producto_id")))
                mov_req = MovimientoInventarioCrear(**{
                    k: v for k, v in payload_con_id.items() if k != "producto_id"
                })
                res = producto_service.registrar_movimiento_inventario(
                    producto_id=producto_id,
                    empresa_id=current_user.empresa_id,
                    data=mov_req,
                    usuario=current_user,
                    db=db,
                )
                if res["idempotente"]:
                    idempotentes += 1
                    estado_op = "IDEMPOTENTE"
                else:
                    sincronizadas += 1
                    estado_op = "SINCRONIZADO"
                resultados.append({
                    "client_operation_id": op.client_operation_id,
                    "tipo": op.tipo,
                    "estado": estado_op,
                    "server_id": str(res["movimiento"].id),
                    "mensaje": "Movimiento de inventario sincronizado",
                })

            elif op.tipo == "movimiento_caja":
                caja_req = MovimientoCajaRequest(**payload_con_id)
                res = registrar_movimiento_caja(data=caja_req, db=db, current_user=current_user)
                if res.get("idempotente"):
                    idempotentes += 1
                    estado_op = "IDEMPOTENTE"
                else:
                    sincronizadas += 1
                    estado_op = "SINCRONIZADO"
                resultados.append({
                    "client_operation_id": op.client_operation_id,
                    "tipo": op.tipo,
                    "estado": estado_op,
                    "server_id": res["movimiento"]["id"],
                    "mensaje": res["mensaje"],
                })

            elif op.tipo == "comprobante_qr":
                comp_req = CrearComprobanteRequest(**payload_con_id)
                res = registrar_comprobante(data=comp_req, db=db, current_user=current_user)
                if res.get("idempotente"):
                    idempotentes += 1
                    estado_op = "IDEMPOTENTE"
                else:
                    sincronizadas += 1
                    estado_op = "SINCRONIZADO"
                resultados.append({
                    "client_operation_id": op.client_operation_id,
                    "tipo": op.tipo,
                    "estado": estado_op,
                    "server_id": res["comprobante"]["id"],
                    "mensaje": res["mensaje"],
                })

        except HTTPException as http_exc:
            db.rollback()
            conflictos += 1
            resultados.append({
                "client_operation_id": op.client_operation_id,
                "tipo": op.tipo,
                "estado": "CONFLICTO" if http_exc.status_code in (400, 409) else "ERROR",
                "codigo_http": http_exc.status_code,
                "mensaje": str(http_exc.detail),
            })
        except Exception as exc:
            db.rollback()
            conflictos += 1
            resultados.append({
                "client_operation_id": op.client_operation_id,
                "tipo": op.tipo,
                "estado": "ERROR",
                "codigo_http": 500,
                "mensaje": str(exc),
            })

    return {
        "procesadas": len(data.operaciones),
        "sincronizadas": sincronizadas,
        "idempotentes": idempotentes,
        "conflictos": conflictos,
        "resultados": resultados,
    }
