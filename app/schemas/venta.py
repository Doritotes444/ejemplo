from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class DetalleVentaCrear(BaseModel):
    producto_id: UUID
    cantidad: Decimal

    @field_validator("cantidad")
    @classmethod
    def cantidad_positiva(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
        return v


class VentaCrear(BaseModel):
    detalles: List[DetalleVentaCrear]
    metodo_pago: str = "efectivo"
    monto_recibido: Optional[Decimal] = None
    cliente_nombre: Optional[str] = None
    notas: Optional[str] = None
    client_operation_id: Optional[str] = None

    @field_validator("detalles")
    @classmethod
    def carrito_no_vacio(cls, v: List[DetalleVentaCrear]) -> List[DetalleVentaCrear]:
        if not v:
            raise ValueError("El carrito no puede estar vacío")
        return v


class VentaAnularRequest(BaseModel):
    motivo: str

    @field_validator("motivo")
    @classmethod
    def motivo_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El motivo de anulación es obligatorio")
        return v


class DetalleVentaRespuesta(BaseModel):
    """
    producto_nombre se extrae del objeto ORM via model_validator.
    El service debe hacer joinedload(DetalleVenta.producto) antes
    de serializar para que este campo esté disponible.
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    producto_id: UUID
    cantidad: float
    precio_unitario: float
    subtotal: float
    producto_nombre: str

    @model_validator(mode="before")
    @classmethod
    def _extraer_producto_nombre(cls, data):
        # Si viene directo del ORM (no es dict), extraemos producto.nombre
        if not isinstance(data, dict):
            return {
                "id": data.id,
                "producto_id": data.producto_id,
                "cantidad": data.cantidad,
                "precio_unitario": float(data.precio_unitario),
                "subtotal": float(data.subtotal),
                "producto_nombre": (
                    data.producto.nombre if data.producto else ""
                ),
            }
        return data


class VentaRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    empresa_id: UUID
    fecha_venta: datetime
    total: float
    usuario_id: Optional[UUID] = None
    vendedor_nombre_snapshot: Optional[str] = None
    metodo_pago: str = "efectivo"
    monto_recibido: Optional[float] = None
    cambio_entregado: Optional[float] = 0.0
    estado: str = "completada"
    motivo_anulacion: Optional[str] = None
    anulada_en: Optional[datetime] = None
    cliente_nombre: Optional[str] = None
    notas: Optional[str] = None
    client_operation_id: Optional[str] = None
    detalles: List[DetalleVentaRespuesta]


class VentaResumen(BaseModel):
    """Respuesta inmediata después de registrar una venta."""
    mensaje: str
    total: float
    venta_id: UUID
    id: Optional[UUID] = None
    metodo_pago: str = "efectivo"
    cambio_entregado: float = 0.0
    idempotente: bool = False
    client_operation_id: Optional[str] = None

    @model_validator(mode="after")
    def _poblar_id(self):
        if self.id is None:
            self.id = self.venta_id
        return self
