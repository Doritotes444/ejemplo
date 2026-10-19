import base64
import os
import urllib.parse
import uuid as uuid_lib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.schemas.producto import (
    MovimientoInventarioCrear,
    ProductoActualizar,
    ProductoCrear,
)
from app.services.audit_service import registrar_auditoria

_EXTENSIONES_PERMITIDAS = {"jpg", "jpeg", "png", "webp"}


def _generar_svg_provisional(nombre: str, categoria: Optional[str] = None) -> str:
    """
    Genera una imagen SVG ligera embebida (data URI) para productos registrados en captura
    provisional, garantizando disponibilidad offline inmediata sin depender de servicios externos.
    """
    iniciales = "".join([p[0].upper() for p in (nombre or "PR").split()[:2]]) or "PR"
    cat_label = (categoria or "Provisional")[:16]
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">'
        f'<rect width="240" height="240" rx="24" fill="#F1F5F9"/>'
        f'<rect x="16" y="16" width="208" height="208" rx="18" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="6 4"/>'
        f'<circle cx="120" cy="96" r="42" fill="#EFF6FF"/>'
        f'<text x="120" y="108" text-anchor="middle" font-family="system-ui,sans-serif" font-size="30" font-weight="700" fill="#1D4ED8">{iniciales}</text>'
        f'<text x="120" y="168" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#334155">{cat_label}</text>'
        f'<text x="120" y="192" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="500" fill="#D97706">FOTO PENDIENTE</text>'
        f'</svg>'
    )
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _obtener_producto_activo(
    producto_id: UUID, empresa_id: UUID, db: Session
) -> models.Producto:
    """Busca el producto validando pertenencia a la empresa. Lanza 404 si no existe."""
    producto = db.query(models.Producto).filter(
        models.Producto.id == producto_id,
        models.Producto.empresa_id == empresa_id,
        models.Producto.is_active.is_(True),
    ).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )
    return producto


def _validar_codigo_barras_unico(
    codigo_barras: str,
    empresa_id: UUID,
    db: Session,
    excluir_id: UUID | None = None,
) -> None:
    """Lanza 409 si el código de barras ya está en uso por otro producto activo de la MISMA empresa."""
    query = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.codigo_barras == codigo_barras,
        models.Producto.is_active.is_(True),
    )
    if excluir_id:
        query = query.filter(models.Producto.id != excluir_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un producto con el código '{codigo_barras}' en tu tienda",
        )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def crear_producto(
    data: ProductoCrear,
    db: Session,
    commit: bool = True,
    usuario: Optional[models.Usuario] = None,
) -> models.Producto:
    # pre-check: empresa existe
    if not db.query(models.Empresa).filter(
        models.Empresa.id == data.empresa_id,
        models.Empresa.is_active.is_(True),
    ).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada",
        )

    # Validar límite de productos del plan comercial
    from app.services import entitlement_service
    entitlement_service.verificar_cupo_productos(data.empresa_id, db)

    # Validar obligatoriedad de fotografía cuando se solicita registro definitivo
    foto_limpia = (data.foto_url or "").strip()
    if data.exigir_foto and not foto_limpia and not data.es_provisional:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fotografía del producto es obligatoria para completar el registro definitivo.",
        )

    # Si no se envió fotografía, se marca explícitamente como captura provisional con placeholder local
    es_provisional = data.es_provisional or (not foto_limpia)
    if not foto_limpia:
        foto_limpia = _generar_svg_provisional(data.nombre, data.categoria)

    # pre-check: código de barras único por empresa
    _validar_codigo_barras_unico(data.codigo_barras, data.empresa_id, db)

    producto = models.Producto(
        empresa_id=data.empresa_id,
        nombre=data.nombre,
        codigo_barras=data.codigo_barras,
        precio_costo=data.precio_costo,
        precio_venta=data.precio_venta,
        cantidad_actual=data.cantidad_actual,
        stock_minimo=data.stock_minimo,
        unidad_medida=data.unidad_medida,
        fecha_vencimiento=data.fecha_vencimiento,
        categoria=data.categoria,
        foto_url=foto_limpia,
        proveedor=data.proveedor.strip() if data.proveedor else None,
        tiempo_reposicion_dias=max(1, int(data.tiempo_reposicion_dias or 1)),
        es_provisional=es_provisional,
        es_frecuente=bool(data.es_frecuente),
        is_active=True,
    )
    db.add(producto)
    db.flush()

    if Decimal(str(data.cantidad_actual)) > 0:
        mov_inicial = models.MovimientoInventario(
            empresa_id=data.empresa_id,
            producto_id=producto.id,
            usuario_id=usuario.id if usuario else None,
            usuario_nombre_snapshot=(usuario.nombre or usuario.email) if usuario else "Sistema",
            tipo="inicial",
            cantidad=Decimal(str(data.cantidad_actual)),
            stock_anterior=Decimal("0.000"),
            stock_nuevo=Decimal(str(data.cantidad_actual)),
            costo_unitario=data.precio_costo,
            motivo="Inventario inicial al registrar producto",
        )
        db.add(mov_inicial)

    if commit:
        db.commit()
        db.refresh(producto)
    else:
        db.flush()
    return producto


def reabastecer_producto(
    producto_id: UUID,
    empresa_id: UUID,
    cantidad: float | Decimal,
    db: Session,
    commit: bool = True,
    nuevo_precio_costo: float | Decimal | None = None,
    nuevo_precio_venta: float | Decimal | None = None,
    motivo: str = "Entrada de mercancía / reabastecimiento",
    usuario: Optional[models.Usuario] = None,
) -> models.Producto:
    """Incrementa el stock de un producto existente con lock pesimista y registra el movimiento."""
    producto = (
        db.query(models.Producto)
        .filter(
            models.Producto.id == producto_id,
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado en esta empresa",
        )

    stock_anterior = Decimal(str(producto.cantidad_actual))
    delta = Decimal(str(cantidad))
    producto.cantidad_actual = stock_anterior + delta

    if nuevo_precio_costo is not None:
        producto.precio_costo = Decimal(str(nuevo_precio_costo))
    if nuevo_precio_venta is not None:
        producto.precio_venta = Decimal(str(nuevo_precio_venta))

    mov = models.MovimientoInventario(
        empresa_id=empresa_id,
        producto_id=producto.id,
        usuario_id=usuario.id if usuario else None,
        usuario_nombre_snapshot=(usuario.nombre or usuario.email) if usuario else "Sistema",
        tipo="entrada",
        cantidad=delta,
        stock_anterior=stock_anterior,
        stock_nuevo=producto.cantidad_actual,
        costo_unitario=producto.precio_costo,
        motivo=motivo,
    )
    db.add(mov)

    if commit:
        db.commit()
        db.refresh(producto)
    else:
        db.flush()
    return producto


def registrar_movimiento_inventario(
    producto_id: UUID,
    empresa_id: UUID,
    data: MovimientoInventarioCrear,
    usuario: models.Usuario,
    db: Session,
) -> dict:
    """
    Registra un movimiento auditable de inventario (entrada, salida o ajuste físico)
    con soporte de idempotencia mediante client_operation_id.
    """
    if data.client_operation_id:
        existente = db.query(models.MovimientoInventario).filter(
            models.MovimientoInventario.empresa_id == empresa_id,
            models.MovimientoInventario.client_operation_id == data.client_operation_id,
        ).first()
        if existente:
            prod = _obtener_producto_activo(producto_id, empresa_id, db)
            return {"movimiento": existente, "producto": prod, "idempotente": True}

    producto = (
        db.query(models.Producto)
        .filter(
            models.Producto.id == producto_id,
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )

    stock_anterior = Decimal(str(producto.cantidad_actual))
    cantidad_req = Decimal(str(data.cantidad))

    if data.tipo == "entrada":
        if cantidad_req <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cantidad de entrada debe ser mayor a 0",
            )
        stock_nuevo = stock_anterior + cantidad_req
        cantidad_mov = cantidad_req
    elif data.tipo == "salida":
        if cantidad_req <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cantidad de salida debe ser mayor a 0",
            )
        if stock_anterior < cantidad_req:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente para dar salida ({stock_anterior} disponibles)",
            )
        stock_nuevo = stock_anterior - cantidad_req
        cantidad_mov = cantidad_req
    elif data.tipo == "ajuste":
        if cantidad_req < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El conteo físico de ajuste no puede ser negativo",
            )
        stock_nuevo = cantidad_req
        cantidad_mov = abs(stock_nuevo - stock_anterior)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de movimiento inválido")

    producto.cantidad_actual = stock_nuevo
    if data.nuevo_precio_costo is not None:
        producto.precio_costo = data.nuevo_precio_costo
    if data.nuevo_precio_venta is not None:
        producto.precio_venta = data.nuevo_precio_venta

    mov = models.MovimientoInventario(
        empresa_id=empresa_id,
        producto_id=producto.id,
        usuario_id=usuario.id,
        usuario_nombre_snapshot=usuario.nombre or usuario.email,
        tipo=data.tipo,
        cantidad=cantidad_mov,
        stock_anterior=stock_anterior,
        stock_nuevo=stock_nuevo,
        costo_unitario=producto.precio_costo,
        motivo=data.motivo,
        client_operation_id=data.client_operation_id,
    )
    db.add(mov)

    registrar_auditoria(
        db=db,
        accion=f"INVENTARIO_{data.tipo.upper()}",
        empresa_id=empresa_id,
        usuario_id=usuario.id,
        actor_email=usuario.email,
        entidad="producto",
        entidad_id=str(producto.id),
        detalle=f"{producto.nombre}: {stock_anterior} -> {stock_nuevo} ({data.motivo})",
    )

    db.commit()
    db.refresh(mov)
    db.refresh(producto)
    return {"movimiento": mov, "producto": producto, "idempotente": False}


def listar_movimientos_inventario(
    empresa_id: UUID,
    db: Session,
    producto_id: Optional[UUID] = None,
    tipo: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    query = (
        db.query(models.MovimientoInventario, models.Producto.nombre, models.Producto.codigo_barras)
        .join(models.Producto, models.Producto.id == models.MovimientoInventario.producto_id)
        .filter(models.MovimientoInventario.empresa_id == empresa_id)
    )
    if producto_id:
        query = query.filter(models.MovimientoInventario.producto_id == producto_id)
    if tipo:
        query = query.filter(models.MovimientoInventario.tipo == tipo)

    filas = query.order_by(models.MovimientoInventario.created_at.desc()).limit(limit).all()
    resultado = []
    for mov, prod_nombre, cod_barras in filas:
        resultado.append({
            "id": mov.id,
            "empresa_id": mov.empresa_id,
            "producto_id": mov.producto_id,
            "producto_nombre": prod_nombre,
            "codigo_barras": cod_barras,
            "usuario_id": mov.usuario_id,
            "usuario_nombre_snapshot": mov.usuario_nombre_snapshot,
            "tipo": mov.tipo,
            "cantidad": float(mov.cantidad),
            "stock_anterior": float(mov.stock_anterior),
            "stock_nuevo": float(mov.stock_nuevo),
            "costo_unitario": float(mov.costo_unitario) if mov.costo_unitario is not None else None,
            "motivo": mov.motivo,
            "referencia_id": mov.referencia_id,
            "created_at": mov.created_at,
        })
    return resultado


def obtener_producto_por_id(
    producto_id: UUID, empresa_id: UUID, db: Session
) -> models.Producto:
    """Obtiene un producto específico validando pertenencia a la empresa."""
    return _obtener_producto_activo(producto_id, empresa_id, db)


def obtener_producto_por_codigo_barras(
    codigo_barras: str, empresa_id: UUID, db: Session
) -> models.Producto:
    """Busca un producto activo por código de barras en el catálogo de la tienda."""
    codigo = codigo_barras.strip()
    producto = db.query(models.Producto).filter(
        models.Producto.empresa_id == empresa_id,
        models.Producto.codigo_barras == codigo,
        models.Producto.is_active.is_(True),
    ).first()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe ningún producto registrado con el código '{codigo}'",
        )
    return producto


def obtener_productos_empresa(empresa_id: UUID, db: Session) -> dict:
    empresa = db.query(models.Empresa).filter(
        models.Empresa.id == empresa_id,
        models.Empresa.is_active.is_(True),
    ).first()
    if not empresa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada",
        )

    productos = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
        )
        .order_by(models.Producto.es_frecuente.desc(), models.Producto.nombre.asc())
        .all()
    )

    for p in productos:
        if not p.foto_url:
            p.foto_url = _generar_svg_provisional(p.nombre, p.categoria.value if hasattr(p.categoria, "value") else str(p.categoria or ""))

    return {
        "tienda": empresa.nombre_comercial,
        "total_items": len(productos),
        "inventario": productos,
    }


def actualizar_producto(
    producto_id: UUID,
    empresa_id: UUID,
    data: ProductoActualizar,
    db: Session,
    usuario: Optional[models.Usuario] = None,
) -> models.Producto:
    producto = _obtener_producto_activo(producto_id, empresa_id, db)

    # pre-check: nuevo código de barras no colisiona con otro producto de la misma tienda
    if data.codigo_barras and data.codigo_barras != producto.codigo_barras:
        _validar_codigo_barras_unico(data.codigo_barras, empresa_id, db, excluir_id=producto_id)

    stock_anterior = Decimal(str(producto.cantidad_actual))
    campos = data.model_dump(exclude_unset=True)

    # Si se sube una fotografía real, deja de ser provisional automáticamente
    if "foto_url" in campos and campos["foto_url"] and not str(campos["foto_url"]).startswith("data:image/svg+xml"):
        if "es_provisional" not in campos:
            producto.es_provisional = False

    for campo, valor in campos.items():
        setattr(producto, campo, valor)

    stock_nuevo = Decimal(str(producto.cantidad_actual))
    if "cantidad_actual" in campos and stock_nuevo != stock_anterior:
        mov = models.MovimientoInventario(
            empresa_id=empresa_id,
            producto_id=producto.id,
            usuario_id=usuario.id if usuario else None,
            usuario_nombre_snapshot=(usuario.nombre or usuario.email) if usuario else "Admin",
            tipo="ajuste",
            cantidad=abs(stock_nuevo - stock_anterior),
            stock_anterior=stock_anterior,
            stock_nuevo=stock_nuevo,
            costo_unitario=producto.precio_costo,
            motivo="Ajuste directo en edición de producto",
        )
        db.add(mov)

    db.commit()
    db.refresh(producto)
    return producto


def eliminar_producto(producto_id: UUID, empresa_id: UUID, db: Session) -> None:
    """Soft delete: pone is_active=False y libera el código de barras por si se vuelve a crear."""
    producto = _obtener_producto_activo(producto_id, empresa_id, db)
    producto.is_active = False
    sufijo = f"__del_{str(producto.id)[:6]}"
    if not producto.codigo_barras.endswith(sufijo):
        producto.codigo_barras = f"{producto.codigo_barras[:85]}{sufijo}"
    db.commit()


def obtener_alertas_inteligentes(empresa_id: UUID, db: Session) -> dict:
    """
    Calcula alertas inteligentes de inventario (Sección 9):
    - Productos agotados
    - Productos con stock bajo (<= stock_minimo)
    - Recomendaciones de compra según velocidad de venta de los últimos 30 días y tiempo de reposición
    - Productos de baja rotación (con stock inmovilizado y sin ventas recientes)
    - Productos próximos a vencer
    """
    productos = (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
        )
        .all()
    )

    hace_30_dias = datetime.now(timezone.utc) - timedelta(days=30)
    ventas_30d = (
        db.query(
            models.DetalleVenta.producto_id,
            func.coalesce(func.sum(models.DetalleVenta.cantidad), 0).label("unidades_vendidas"),
        )
        .join(models.Venta, models.Venta.id == models.DetalleVenta.venta_id)
        .filter(
            models.Venta.empresa_id == empresa_id,
            models.Venta.is_active.is_(True),
            models.Venta.estado != "anulada",
            models.Venta.fecha_venta >= hace_30_dias,
        )
        .group_by(models.DetalleVenta.producto_id)
        .all()
    )
    mapa_ventas_30d = {row.producto_id: float(row.unidades_vendidas) for row in ventas_30d}

    hoy = date.today()
    agotados = []
    stock_bajo = []
    reposicion_recomendada = []
    baja_rotacion = []
    proximos_a_vencer = []

    for p in productos:
        stock = float(p.cantidad_actual or 0)
        minimo = float(p.stock_minimo if p.stock_minimo is not None else 5.0)
        vendidas_30d = mapa_ventas_30d.get(p.id, 0.0)
        velocidad_diaria = round(vendidas_30d / 30.0, 2)
        dias_reposicion = max(1, int(p.tiempo_reposicion_dias or 1))
        dias_cobertura = round(stock / velocidad_diaria, 1) if velocidad_diaria > 0 else (999.0 if stock > 0 else 0.0)

        # Cantidad sugerida para cubrir 15 días de operación + tiempo de reposición + stock mínimo
        demanda_ciclo = velocidad_diaria * (15 + dias_reposicion)
        objetivo_stock = max(minimo * 2, round(demanda_ciclo, 1))
        sugerido_pedir = max(0.0, round(objetivo_stock - stock, 1))
        costo_estimado_pedido = round(sugerido_pedir * float(p.precio_costo or 0), 2)

        item_info = {
            "id": str(p.id),
            "nombre": p.nombre,
            "codigo_barras": p.codigo_barras,
            "foto_url": p.foto_url or _generar_svg_provisional(p.nombre),
            "categoria": p.categoria.value if hasattr(p.categoria, "value") else p.categoria,
            "unidad_medida": p.unidad_medida.value if hasattr(p.unidad_medida, "value") else str(p.unidad_medida),
            "cantidad_actual": stock,
            "stock_minimo": minimo,
            "proveedor": p.proveedor or "Proveedor general",
            "tiempo_reposicion_dias": dias_reposicion,
            "unidades_vendidas_30d": vendidas_30d,
            "velocidad_diaria": velocidad_diaria,
            "dias_cobertura": dias_cobertura,
            "cantidad_sugerida_pedido": sugerido_pedir,
            "costo_estimado_pedido": costo_estimado_pedido,
            "capital_inmovilizado": round(stock * float(p.precio_costo or 0), 2),
        }

        if stock <= 0:
            agotados.append({**item_info, "urgencia": "CRITICA", "mensaje": "Agotado — pedir de inmediato"})
            reposicion_recomendada.append({**item_info, "urgencia": "CRITICA"})
        elif stock <= minimo:
            stock_bajo.append({**item_info, "urgencia": "ALTA", "mensaje": f"Quedan {stock:g} (mínimo {minimo:g})"})
            reposicion_recomendada.append({**item_info, "urgencia": "ALTA"})
        elif velocidad_diaria > 0 and dias_cobertura <= (dias_reposicion + 3):
            reposicion_recomendada.append({
                **item_info,
                "urgencia": "MEDIA",
                "mensaje": f"Cobertura para {dias_cobertura} días (proveedor tarda {dias_reposicion}d)",
            })

        if stock > minimo and vendidas_30d == 0:
            baja_rotacion.append({
                **item_info,
                "mensaje": "Sin ventas en los últimos 30 días — considera promoción o combo",
            })

        if p.fecha_vencimiento:
            dias_para_vencer = (p.fecha_vencimiento - hoy).days
            if dias_para_vencer <= 15:
                proximos_a_vencer.append({
                    **item_info,
                    "fecha_vencimiento": p.fecha_vencimiento.isoformat(),
                    "dias_para_vencer": dias_para_vencer,
                    "vencido": dias_para_vencer < 0,
                })

    costo_total_reposicion = round(sum(i["costo_estimado_pedido"] for i in reposicion_recomendada), 2)
    capital_baja_rotacion = round(sum(i["capital_inmovilizado"] for i in baja_rotacion), 2)

    return {
        "resumen": {
            "total_agotados": len(agotados),
            "agotados": len(agotados),
            "total_stock_bajo": len(stock_bajo),
            "bajo_stock": len(stock_bajo),
            "total_reposicion_recomendada": len(reposicion_recomendada),
            "total_baja_rotacion": len(baja_rotacion),
            "total_proximos_a_vencer": len(proximos_a_vencer),
            "costo_total_reposicion_sugerida": costo_total_reposicion,
            "capital_inmovilizado_baja_rotacion": capital_baja_rotacion,
        },
        "agotados": agotados,
        "stock_bajo": stock_bajo,
        "reposicion_recomendada": reposicion_recomendada,
        "baja_rotacion": baja_rotacion,
        "proximos_a_vencer": proximos_a_vencer,
    }


async def guardar_imagen_producto(
    producto_id: UUID,
    empresa_id: UUID,
    file: UploadFile,
    db: Session,
) -> str:
    producto = _obtener_producto_activo(producto_id, empresa_id, db)

    # Validar extensión del archivo
    extension = (
        file.filename.rsplit(".", 1)[-1].lower()
        if file.filename and "." in file.filename
        else ""
    )
    if extension not in _EXTENSIONES_PERMITIDAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Usa: {', '.join(_EXTENSIONES_PERMITIDAS)}",
        )

    # 1. Leer el contenido y validar el tamaño límite (máx 5 MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo excede el tamaño máximo permitido de 5 MB",
        )

    # 2. Validar firma mágica binaria (Magic Bytes) para asegurar la integridad de la imagen
    es_imagen_valida = False
    if content.startswith(b"\xff\xd8\xff"):  # JPEG
        es_imagen_valida = True
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):  # PNG
        es_imagen_valida = True
    elif content.startswith(b"RIFF") and b"WEBP" in content[8:12]:  # WEBP
        es_imagen_valida = True

    if not es_imagen_valida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contenido del archivo no es una imagen válida (debe ser un JPEG, PNG o WEBP real)",
        )

    upload_dir = os.getenv("UPLOAD_DIR", "media")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid_lib.uuid4()}.{extension}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    producto.foto_url = f"/media/{filename}"
    producto.es_provisional = False
    db.commit()
    return producto.foto_url
