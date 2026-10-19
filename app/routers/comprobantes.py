import json
import re
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
from app.services import entitlement_service
from app.services.audit_service import registrar_auditoria

router = APIRouter(prefix="/comprobantes", tags=["Comprobantes QR y Respaldo de Pagos"])


class AnalizarQRRequest(BaseModel):
    qr_raw_data: str


class CrearComprobanteRequest(BaseModel):
    venta_id: Optional[UUID] = None
    billetera: Optional[str] = None
    metodo_pago: Optional[str] = None
    referencia_pago: Optional[str] = None
    referencia_transaccion: Optional[str] = None
    pagador_nombre: Optional[str] = None
    monto: Decimal = Decimal("0.00")
    qr_raw_data: Optional[str] = None
    imagen_data: Optional[str] = None
    foto_comprobante_url: Optional[str] = None
    imagen_mime: str = "image/jpeg"
    estado_verificacion: Literal["CAPTURADO_NO_VERIFICADO", "VERIFICADO_MANUALMENTE"] = "CAPTURADO_NO_VERIFICADO"
    verificado_manualmente: Optional[bool] = None
    notas: Optional[str] = None
    client_operation_id: Optional[str] = None

    def obtener_imagen(self) -> str:
        img = (self.imagen_data or self.foto_comprobante_url or "").strip()
        if not img:
            raise ValueError("La fotografía del comprobante es obligatoria como respaldo")
        return img

    @field_validator("monto")
    @classmethod
    def monto_no_negativo(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El monto del comprobante no puede ser negativo")
        return v


class VerificarComprobanteRequest(BaseModel):
    estado_verificacion: Literal["CAPTURADO_NO_VERIFICADO", "VERIFICADO_MANUALMENTE", "RECHAZADO"]
    referencia_pago: Optional[str] = None
    notas: Optional[str] = None


def parsear_qr_colombia(raw: str) -> dict:
    """
    Extrae metadatos estructurados de cadenas QR de pagos en Colombia (EMVCo, Nequi,
    DaviPlata, Bancolombia, Bre-B, JSON o URL) aclarando siempre que es una lectura
    técnica local y NO una confirmación bancaria en línea.
    """
    texto = (raw or "").strip()
    billetera = "otro"
    referencia = None
    monto = 0.0

    low = texto.lower()
    if "nequi" in low:
        billetera = "nequi"
    elif "daviplata" in low or "davivienda" in low:
        billetera = "daviplata"
    elif "bancolombia" in low or "ahorro a la mano" in low:
        billetera = "bancolombia"
    elif "bre-b" in low or "breb" in low:
        billetera = "bre_b"

    # Intento 1: JSON estructurado
    if texto.startswith("{") and texto.endswith("}"):
        try:
            obj = json.loads(texto)
            billetera = str(obj.get("billetera") or obj.get("provider") or billetera).lower()
            referencia = str(obj.get("referencia") or obj.get("ref") or obj.get("id") or "")
            if obj.get("monto") or obj.get("amount") or obj.get("valor"):
                monto = float(obj.get("monto") or obj.get("amount") or obj.get("valor") or 0)
        except Exception:
            pass

    # Intento 2: Trama EMVCo (000201...)
    if texto.startswith("000201"):
        if billetera == "otro":
            billetera = "bre_b"
        m_monto = re.search(r"54(\d{2})(\d+(?:\.\d+)?)", texto)
        if m_monto:
            length = int(m_monto.group(1))
            val_str = m_monto.group(2)[:length]
            try:
                monto = float(val_str)
            except ValueError:
                pass

    # Intento 3: Búsqueda de referencia alfanumérica o monto en texto/URL
    if not referencia:
        m_ref = re.search(r"(?:ref|referencia|comprobante|trn|id)[=:\s#-]*([A-Za-z0-9_-]{4,32})", texto, re.IGNORECASE)
        if m_ref:
            referencia = m_ref.group(1)
        elif len(texto) <= 40 and re.match(r"^[A-Za-z0-9_-]+$", texto):
            referencia = texto

    if monto == 0.0:
        m_val = re.search(r"(?:monto|valor|amount|total)[=:\s$]*([0-9]+(?:\.[0-9]{1,2})?)", texto, re.IGNORECASE)
        if m_val:
            try:
                monto = float(m_val.group(1))
            except ValueError:
                pass

    ref_final = referencia or f"QR-{abs(hash(texto)) % 1000000:06d}"
    entidad_humana = (
        "Nequi"
        if billetera == "nequi"
        else "DaviPlata"
        if billetera == "daviplata"
        else "Bancolombia"
        if billetera == "bancolombia"
        else "Bre-B"
        if billetera == "bre_b"
        else "Desconocida"
    )
    return {
        "billetera_detectada": billetera,
        "referencia_detectada": ref_final,
        "monto_detectado": monto,
        "qr_raw_data": texto,
        "estado_inicial": "CAPTURADO_NO_VERIFICADO",
        "estado_verificacion": "CAPTURADO_NO_VERIFICADO",
        "datos_extraidos": {
            "entidad_detectada": entidad_humana,
            "referencia_sugerida": ref_final,
            "monto_sugerido": monto,
        },
        "advertencia_seguridad": (
            "COMPROBANTE CAPTURADO (NO VERIFICADO POR BANCO): Escanear un código QR o "
            "guardar la foto del pantallazo NO confirma que el dinero haya ingresado a tu cuenta. "
            "Verifica la notificación real en tu app bancaria antes de marcarlo como verificado."
        ),
    }


def _serializar_comprobante(c: models.ComprobantePago, incluir_imagen: bool = False) -> dict:
    data = {
        "id": str(c.id),
        "empresa_id": str(c.empresa_id),
        "venta_id": str(c.venta_id) if c.venta_id else None,
        "usuario_id": str(c.usuario_id) if c.usuario_id else None,
        "usuario_nombre_snapshot": c.usuario_nombre_snapshot,
        "billetera": c.billetera,
        "metodo_pago": (c.billetera or "nequi").capitalize(),
        "referencia_pago": c.referencia_pago,
        "referencia_transaccion": c.referencia_pago,
        "monto": float(c.monto or 0),
        "qr_raw_data": c.qr_raw_data,
        "tiene_imagen": bool(c.imagen_data),
        "estado_verificacion": c.estado_verificacion,
        "es_verificado_oficialmente": False,
        "etiqueta_estado": (
            "Verificado manualmente por tienda"
            if c.estado_verificacion == "VERIFICADO_MANUALMENTE"
            else (
                "Rechazado / Inválido"
                if c.estado_verificacion == "RECHAZADO"
                else "Capturado / Pendiente de confirmar en banco"
            )
        ),
        "verificado_por_id": str(c.verificado_por_id) if c.verificado_por_id else None,
        "verificado_en": c.verificado_en.isoformat() if c.verificado_en else None,
        "notas": c.notas,
        "client_operation_id": c.client_operation_id,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "fecha_captura": c.created_at.isoformat() if c.created_at else None,
    }
    if incluir_imagen:
        data["imagen_data"] = c.imagen_data
        data["foto_comprobante_url"] = c.imagen_data
        data["imagen_mime"] = c.imagen_mime
    return data


@router.post("/analizar-qr")
def analizar_qr(
    data: AnalizarQRRequest,
    current_user: models.Usuario = Depends(get_current_user),
):
    return parsear_qr_colombia(data.qr_raw_data)


@router.post("", status_code=status.HTTP_201_CREATED)
def registrar_comprobante(
    data: CrearComprobanteRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    if data.client_operation_id:
        existente = (
            db.query(models.ComprobantePago)
            .filter(
                models.ComprobantePago.empresa_id == current_user.empresa_id,
                models.ComprobantePago.client_operation_id == data.client_operation_id,
            )
            .first()
        )
        if existente:
            return {
                "mensaje": "Comprobante QR ya sincronizado previamente (idempotente)",
                "idempotente": True,
                "comprobante": _serializar_comprobante(existente, incluir_imagen=True),
            }

    # Verificar cupo mensual de comprobantes QR según el plan comercial
    empresa = db.query(models.Empresa).filter(models.Empresa.id == current_user.empresa_id).first()
    if empresa:
        cfg = entitlement_service.obtener_config_plan(empresa.plan, db)
        inicio_mes = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        usados = (
            db.query(models.ComprobantePago)
            .filter(
                models.ComprobantePago.empresa_id == current_user.empresa_id,
                models.ComprobantePago.is_active.is_(True),
                models.ComprobantePago.created_at >= inicio_mes,
            )
            .count()
        )
        if usados >= cfg.max_comprobantes_qr:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Has alcanzado el límite de {cfg.max_comprobantes_qr} comprobantes QR mensuales de tu plan {cfg.nombre}.",
            )

    if data.venta_id:
        venta = (
            db.query(models.Venta)
            .filter(
                models.Venta.id == data.venta_id,
                models.Venta.empresa_id == current_user.empresa_id,
            )
            .first()
        )
        if not venta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La venta asociada no existe en esta tienda",
            )

    ahora = datetime.now(timezone.utc)
    estado_final = (
        "VERIFICADO_MANUALMENTE"
        if data.verificado_manualmente is True
        else data.estado_verificacion
    )
    es_verificado = estado_final == "VERIFICADO_MANUALMENTE"
    billetera_final = (data.billetera or data.metodo_pago or "nequi").lower().strip()
    ref_final = (data.referencia_pago or data.referencia_transaccion or "").strip() or None

    comp = models.ComprobantePago(
        empresa_id=current_user.empresa_id,
        venta_id=data.venta_id,
        usuario_id=current_user.id,
        usuario_nombre_snapshot=current_user.nombre or current_user.email,
        billetera=billetera_final,
        referencia_pago=ref_final,
        monto=data.monto,
        qr_raw_data=data.qr_raw_data,
        imagen_data=data.obtener_imagen(),
        imagen_mime=data.imagen_mime,
        estado_verificacion=estado_final,
        verificado_por_id=current_user.id if es_verificado else None,
        verificado_en=ahora if es_verificado else None,
        notas=data.notas,
        client_operation_id=data.client_operation_id,
        is_active=True,
    )
    db.add(comp)
    db.flush()

    registrar_auditoria(
        db=db,
        accion="COMPROBANTE_QR_REGISTRADO",
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        actor_email=current_user.email,
        entidad="comprobante_pago",
        entidad_id=str(comp.id),
        detalle=f"Billetera={comp.billetera} monto=${float(comp.monto):.2f} estado={comp.estado_verificacion}",
    )

    db.commit()
    db.refresh(comp)
    serializado = _serializar_comprobante(comp, incluir_imagen=True)
    return {
        **serializado,
        "mensaje": "Comprobante guardado en bóveda privada. Recuerda verificar el abono real en tu cuenta.",
        "idempotente": False,
        "comprobante": serializado,
    }


@router.get("")
def listar_comprobantes(
    estado_verificacion: Optional[str] = Query(default=None),
    billetera: Optional[str] = Query(default=None),
    venta_id: Optional[UUID] = Query(default=None),
    incluir_imagen: bool = Query(default=True),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    query = db.query(models.ComprobantePago).filter(
        models.ComprobantePago.empresa_id == current_user.empresa_id,
        models.ComprobantePago.is_active.is_(True),
    )
    if estado_verificacion:
        query = query.filter(models.ComprobantePago.estado_verificacion == estado_verificacion)
    if billetera:
        query = query.filter(models.ComprobantePago.billetera == billetera.lower())
    if venta_id:
        query = query.filter(models.ComprobantePago.venta_id == venta_id)

    filas = query.order_by(models.ComprobantePago.created_at.desc()).limit(limit).all()
    return [_serializar_comprobante(c, incluir_imagen=incluir_imagen) for c in filas]


@router.get("/{comprobante_id}/imagen")
def obtener_imagen_privada_comprobante(
    comprobante_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    """
    Acceso estrictamente autenticado y aislado por empresa a la fotografía del comprobante.
    Jamás se expone en directorios públicos sin autorización.
    """
    comp = (
        db.query(models.ComprobantePago)
        .filter(
            models.ComprobantePago.id == comprobante_id,
            models.ComprobantePago.empresa_id == current_user.empresa_id,
            models.ComprobantePago.is_active.is_(True),
        )
        .first()
    )
    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comprobante no encontrado o acceso no autorizado",
        )
    return {
        "id": str(comp.id),
        "imagen_data": comp.imagen_data,
        "foto_comprobante_url": comp.imagen_data,
        "imagen_mime": comp.imagen_mime,
        "estado_verificacion": comp.estado_verificacion,
    }


@router.patch("/{comprobante_id}/verificar")
def actualizar_verificacion_comprobante(
    comprobante_id: UUID,
    data: VerificarComprobanteRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    comp = (
        db.query(models.ComprobantePago)
        .filter(
            models.ComprobantePago.id == comprobante_id,
            models.ComprobantePago.empresa_id == current_user.empresa_id,
            models.ComprobantePago.is_active.is_(True),
        )
        .first()
    )
    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comprobante no encontrado",
        )

    comp.estado_verificacion = data.estado_verificacion
    if data.referencia_pago is not None:
        comp.referencia_pago = data.referencia_pago.strip() or comp.referencia_pago
    if data.notas is not None:
        comp.notas = data.notas.strip()
    if data.estado_verificacion == "VERIFICADO_MANUALMENTE":
        comp.verificado_por_id = current_user.id
        comp.verificado_en = datetime.now(timezone.utc)

    registrar_auditoria(
        db=db,
        accion="COMPROBANTE_QR_VERIFICACION",
        empresa_id=current_user.empresa_id,
        usuario_id=current_user.id,
        actor_email=current_user.email,
        entidad="comprobante_pago",
        entidad_id=str(comp.id),
        detalle=f"Estado cambiado a {comp.estado_verificacion}",
    )

    db.commit()
    db.refresh(comp)
    serializado = _serializar_comprobante(comp, incluir_imagen=True)
    return {
        **serializado,
        "mensaje": f"Estado del comprobante actualizado a {comp.estado_verificacion}",
        "comprobante": serializado,
    }
