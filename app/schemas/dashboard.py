from datetime import date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class StockBajoItem(BaseModel):
    id: str
    nombre: str
    cantidad: float
    stock_minimo: float = 5.0
    foto_url: Optional[str] = None


class TopProductoItem(BaseModel):
    nombre: str
    total_vendido: float
    ingresos: float = 0.0
    utilidad: float = 0.0


class AlertaVencimientoItem(BaseModel):
    id: str
    nombre: str
    fecha_vencimiento: date
    dias_restantes: int


class DashboardRespuesta(BaseModel):
    ventas_hoy: int
    ingresos_hoy: float
    total_productos: int
    stock_bajo: List[StockBajoItem]
    top_productos: List[TopProductoItem]
    alertas_vencimiento: List[AlertaVencimientoItem]
    dias_trial_restantes: Optional[int]
    plan: str
    finanzas_360: Optional[Dict[str, Any]] = None
    productos_mas_rentables: Optional[List[Dict[str, Any]]] = None
    productos_sin_movimiento: Optional[List[Dict[str, Any]]] = None
    estado_caja: Optional[Dict[str, Any]] = None
