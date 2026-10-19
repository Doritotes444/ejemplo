from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, field_validator

UNIDADES = Literal["unidad", "gramo", "libra", "kilo", "caja", "bulto", "kg", "litro", "metro"]
CATEGORIAS = Literal[
    "Bebidas", "Snacks", "Aseo", "Lacteos", "Limpieza", "Panaderia",
    "Abarrotes", "Granos", "Carnes Frias", "Frutas y Verduras", "Licores", "Otros"
]


class ProductoCrear(BaseModel):
    nombre: str
    codigo_barras: str
    precio_costo: Decimal = Decimal("0.00")
    precio_venta: Decimal = Decimal("0.00")
    cantidad_actual: Decimal = Decimal("0.000")
    stock_minimo: Decimal = Decimal("5.000")
    unidad_medida: UNIDADES = "unidad"
    fecha_vencimiento: Optional[date] = None
    categoria: Optional[CATEGORIAS] = None
    foto_url: Optional[str] = None
    proveedor: Optional[str] = None
    tiempo_reposicion_dias: int = 1
    es_provisional: bool = False
    es_frecuente: bool = False
    exigir_foto: bool = False
    empresa_id: Optional[UUID] = None  # Inyectado por el router desde JWT

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre del producto no puede estar vacío")
        return v

    @field_validator("codigo_barras")
    @classmethod
    def codigo_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El código de barras no puede estar vacío")
        return v

    @field_validator("precio_costo", "precio_venta")
    @classmethod
    def precio_no_negativo(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El precio no puede ser negativo")
        return v

    @field_validator("cantidad_actual", "stock_minimo")
    @classmethod
    def stock_no_negativo(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("El stock no puede ser negativo")
        return v


class ProductoActualizar(BaseModel):
    """Todos los campos son opcionales: solo se actualizan los enviados."""
    nombre: Optional[str] = None
    codigo_barras: Optional[str] = None
    precio_costo: Optional[Decimal] = None
    precio_venta: Optional[Decimal] = None
    cantidad_actual: Optional[Decimal] = None
    stock_minimo: Optional[Decimal] = None
    unidad_medida: Optional[UNIDADES] = None
    fecha_vencimiento: Optional[date] = None
    categoria: Optional[CATEGORIAS] = None
    foto_url: Optional[str] = None
    proveedor: Optional[str] = None
    tiempo_reposicion_dias: Optional[int] = None
    es_provisional: Optional[bool] = None
    es_frecuente: Optional[bool] = None
    is_active: Optional[bool] = None

    @field_validator("precio_costo", "precio_venta")
    @classmethod
    def precio_no_negativo(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("El precio no puede ser negativo")
        return v

    @field_validator("cantidad_actual", "stock_minimo")
    @classmethod
    def stock_no_negativo(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("El stock no puede ser negativo")
        return v


class ProductoBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    empresa_id: UUID
    nombre: str
    codigo_barras: str
    precio_venta: float
    cantidad_actual: float
    stock_minimo: float = 5.0
    unidad_medida: str
    fecha_vencimiento: Optional[date] = None
    categoria: Optional[str] = None
    foto_url: Optional[str] = None
    proveedor: Optional[str] = None
    tiempo_reposicion_dias: int = 1
    es_provisional: bool = False
    es_frecuente: bool = False
    created_at: datetime
    is_active: bool


class ProductoAdminOut(ProductoBase):
    """Schema para administradores: incluye precio de costo y margen."""
    precio_costo: float


class ProductoCajeroOut(ProductoBase):
    """Schema estricto para cajeros/vendedores: CERO exposicion de precio_costo."""
    pass


# Retrocompatibilidad para imports existentes
ProductoRespuesta = ProductoAdminOut


class InventarioAdminRespuesta(BaseModel):
    """Respuesta para administradores con costos."""
    tienda: str
    total_items: int
    inventario: List[ProductoAdminOut]


class InventarioCajeroRespuesta(BaseModel):
    """Respuesta para cajeros/vendedores sin costos."""
    tienda: str
    total_items: int
    inventario: List[ProductoCajeroOut]


InventarioRespuesta = InventarioAdminRespuesta


class MovimientoInventarioCrear(BaseModel):
    tipo: Literal["entrada", "salida", "ajuste"]
    cantidad: Decimal
    motivo: str
    nuevo_precio_costo: Optional[Decimal] = None
    nuevo_precio_venta: Optional[Decimal] = None
    client_operation_id: Optional[str] = None

    @field_validator("motivo")
    @classmethod
    def motivo_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Debes indicar un motivo para el movimiento de inventario")
        return v


class MovimientoInventarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    empresa_id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    codigo_barras: Optional[str] = None
    usuario_id: Optional[UUID] = None
    usuario_nombre_snapshot: Optional[str] = None
    tipo: str
    cantidad: float
    stock_anterior: float
    stock_nuevo: float
    costo_unitario: Optional[float] = None
    motivo: Optional[str] = None
    referencia_id: Optional[str] = None
    created_at: datetime
