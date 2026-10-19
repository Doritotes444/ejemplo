"""
Script de inicialización y datos de demostración para Tiendapp (Gestión Inteligente Neiva).
Crea las tablas en la base de datos configurada (SQLite por defecto) y carga una tienda
de barrio colombiana real ("Tienda Don Chucho - Las Granjas, Neiva") con productos,
fotografías vectoriales integradas, turno de caja abierto, ventas, kardex y comprobantes QR.
"""
import os
import urllib.parse
from decimal import Decimal

# Configurar variables por defecto si no existe .env aún
os.environ.setdefault("DATABASE_URL", "sqlite:///./tiendapp_dev.db")
os.environ.setdefault("SECRET_KEY", "tiendapp-secret-key-local-segura-2026-neiva-huila-colombia")
os.environ.setdefault("SUPERADMIN_KEY", "tiendapp-superadmin-2026")

from app.database import Base, SessionLocal, engine
from app import models
from app.services import auth_service, entitlement_service, producto_service, venta_service
from app.schemas.producto import ProductoCrear
from app.schemas.venta import VentaCrear, DetalleVentaCrear


def _svg_data_uri(bg_color: str, accent_color: str, emoji_text: str, label: str, sublabel: str) -> str:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <rect width="300" height="300" rx="28" fill="{bg_color}"/>
      <circle cx="150" cy="118" r="64" fill="{accent_color}" opacity="0.18"/>
      <text x="150" y="138" font-family="Segoe UI Emoji, Apple Color Emoji, sans-serif" font-size="68" text-anchor="middle">{emoji_text}</text>
      <rect x="24" y="202" width="252" height="72" rx="16" fill="#ffffff" opacity="0.92"/>
      <text x="150" y="233" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="800" fill="#0f172a" text-anchor="middle">{label}</text>
      <text x="150" y="258" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#475569" text-anchor="middle">{sublabel}</text>
    </svg>"""
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def inicializar_demo():
    print("1. Creando esquema de base de datos...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        entitlement_service.asegurar_planes_en_bd(db)

        existente = db.query(models.Usuario).filter(models.Usuario.email == "tendero@tiendapp.co").first()
        if existente:
            print("[OK] La tienda de demostracion ya se encuentra cargada.")
            return

        print("2. Registrando tienda 'Tienda Don Chucho - Las Granjas (Neiva)'...")
        reg = auth_service.registrar_usuario_con_empresa(
            nombre_comercial="Tienda Don Chucho - Las Granjas",
            nit_o_cedula="900456789-1",
            email="tendero@tiendapp.co",
            password="Tienda2026!",
            rol=models.RolUsuario.ADMIN,
            db=db,
            nombre="Don Chucho (Administrador)",
        )
        admin_user = reg["usuario"]
        empresa_id = admin_user.empresa_id

        # Activar plan Pro en la tienda demo para poder probar absolutamente todos los módulos
        empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
        empresa.plan = "pro"
        db.commit()

        print("3. Creando usuario cajero ('cajero@tiendapp.co')...")
        cajero_hash = auth_service.hash_password("Cajero2026!")
        cajero = models.Usuario(
            email="cajero@tiendapp.co",
            nombre="Camila Vargas (Cajera)",
            hashed_password=cajero_hash,
            rol=models.RolUsuario.TENDERO,
            empresa_id=empresa_id,
            is_active=True,
        )
        # SuperAdmin de plataforma para login único
        sa_hash = auth_service.hash_password("SuperAdmin2026!")
        superadmin = models.Usuario(
            email="superadmin@tiendapp.co",
            nombre="Equipo Tiendapp (SuperAdmin)",
            hashed_password=sa_hash,
            rol=models.RolUsuario.ADMIN,
            empresa_id=empresa_id,
            es_superadmin=True,
            is_active=True,
        )
        db.add_all([cajero, superadmin])
        db.commit()

        print("4. Poblando catálogo con productos reales y fotografías obligatorias...")
        catalogo = [
            {
                "nombre": "Arroz Diana 500g",
                "codigo_barras": "7702001001",
                "categoria": "Granos",
                "precio_costo": Decimal("2100"),
                "precio_venta": Decimal("2800"),
                "cantidad_actual": Decimal("45"),
                "stock_minimo": Decimal("12"),
                "unidad_medida": "unidad",
                "proveedor": "Distribuidora Diana Huila",
                "tiempo_reposicion_dias": 3,
                "es_favorito_pos": True,
                "foto_url": _svg_data_uri("#f0fdf4", "#16a34a", "🌾", "Arroz Diana", "Bolsa 500 g • $2.800"),
            },
            {
                "nombre": "Leche Alquería Entera 1L",
                "codigo_barras": "7702001002",
                "categoria": "Lacteos",
                "precio_costo": Decimal("3600"),
                "precio_venta": Decimal("4600"),
                "cantidad_actual": Decimal("28"),
                "stock_minimo": Decimal("10"),
                "unidad_medida": "litro",
                "proveedor": "Alquería Regional Sur",
                "tiempo_reposicion_dias": 2,
                "es_favorito_pos": True,
                "foto_url": _svg_data_uri("#eff6ff", "#2563eb", "🥛", "Leche Alquería 1L", "Entera Larga Vida • $4.600"),
            },
            {
                "nombre": "Cubeta Huevos AA x30",
                "codigo_barras": "7702001003",
                "categoria": "Lacteos",
                "precio_costo": Decimal("13500"),
                "precio_venta": Decimal("16500"),
                "cantidad_actual": Decimal("14"),
                "stock_minimo": Decimal("6"),
                "unidad_medida": "unidad",
                "proveedor": "Avícola El Triunfo",
                "tiempo_reposicion_dias": 2,
                "es_favorito_pos": True,
                "foto_url": _svg_data_uri("#fefce8", "#ca8a04", "🥚", "Huevos AA x30", "Cubeta 30 und • $16.500"),
            },
            {
                "nombre": "Aceite Gourmet 1L",
                "codigo_barras": "7702001004",
                "categoria": "Abarrotes",
                "precio_costo": Decimal("9200"),
                "precio_venta": Decimal("11800"),
                "cantidad_actual": Decimal("4"),  # Stock bajo para activar alerta
                "stock_minimo": Decimal("8"),
                "unidad_medida": "litro",
                "proveedor": "Team Foods Colombia",
                "tiempo_reposicion_dias": 5,
                "es_favorito_pos": True,
                "foto_url": _svg_data_uri("#fffbeb", "#d97706", "🫗", "Aceite Gourmet 1L", "Vegetal Puro • $11.800"),
            },
            {
                "nombre": "Pony Malta Personal 330ml",
                "codigo_barras": "7702001005",
                "categoria": "Bebidas",
                "precio_costo": Decimal("1750"),
                "precio_venta": Decimal("2500"),
                "cantidad_actual": Decimal("36"),
                "stock_minimo": Decimal("12"),
                "unidad_medida": "unidad",
                "proveedor": "Bavaria S.A.",
                "tiempo_reposicion_dias": 2,
                "es_favorito_pos": True,
                "foto_url": _svg_data_uri("#fef2f2", "#dc2626", "🥤", "Pony Malta 330ml", "Bebida de Malta • $2.500"),
            },
            {
                "nombre": "Café Sello Rojo 250g",
                "codigo_barras": "7702001006",
                "categoria": "Abarrotes",
                "precio_costo": Decimal("7100"),
                "precio_venta": Decimal("9200"),
                "cantidad_actual": Decimal("18"),
                "stock_minimo": Decimal("6"),
                "unidad_medida": "unidad",
                "proveedor": "Nutresa Comercial",
                "tiempo_reposicion_dias": 4,
                "es_favorito_pos": True,
                "foto_url": _svg_data_uri("#fff1f2", "#be123c", "☕", "Café Sello Rojo", "Molido 250 g • $9.200"),
            },
            {
                "nombre": "Panela Huilense 1kg",
                "codigo_barras": "7702001007",
                "categoria": "Abarrotes",
                "precio_costo": Decimal("3800"),
                "precio_venta": Decimal("5400"),
                "cantidad_actual": Decimal("22"),
                "stock_minimo": Decimal("8"),
                "unidad_medida": "kg",
                "proveedor": "Trapiche San Agustín",
                "tiempo_reposicion_dias": 3,
                "es_favorito_pos": True,
                "foto_url": _svg_data_uri("#fff7ed", "#c2410c", "🍯", "Panela Huilense", "Atado 1 kg • $5.400"),
            },
            {
                "nombre": "Chocolate Corona 500g",
                "codigo_barras": "7702001008",
                "categoria": "Abarrotes",
                "precio_costo": Decimal("6800"),
                "precio_venta": Decimal("8900"),
                "cantidad_actual": Decimal("0"),  # Agotado para alerta crítica
                "stock_minimo": Decimal("5"),
                "unidad_medida": "unidad",
                "proveedor": "Nutresa Comercial",
                "tiempo_reposicion_dias": 4,
                "es_favorito_pos": False,
                "foto_url": _svg_data_uri("#fdf4ff", "#9333ea", "🍫", "Chocolate Corona", "Pastilla 500 g • $8.900"),
            },
        ]

        productos_creados = []
        for item in catalogo:
            prod = producto_service.crear_producto(
                ProductoCrear(**item, empresa_id=empresa_id),
                db,
                usuario=admin_user,
            )
            productos_creados.append(prod)

        print("5. Abriendo turno de caja con base inicial de $50.000...")
        sesion_caja = models.SesionCaja(
            empresa_id=empresa_id,
            usuario_apertura_id=admin_user.id,
            usuario_apertura_nombre=admin_user.nombre,
            estado="abierta",
            monto_inicial=Decimal("50000"),
            total_ventas_efectivo=Decimal("0"),
            total_ventas_digital=Decimal("0"),
            total_ingresos_extra=Decimal("0"),
            total_egresos=Decimal("0"),
            saldo_esperado_efectivo=Decimal("50000"),
            observaciones="Apertura turno mañana — Base completa en billetes sencillos",
        )
        db.add(sesion_caja)
        db.commit()
        db.refresh(sesion_caja)

        print("6. Registrando ventas de ejemplo y movimientos de caja...")
        # Venta 1 en Efectivo
        venta_service.registrar_venta(
            empresa_id=empresa_id,
            data=VentaCrear(
                detalles=[
                    DetalleVentaCrear(producto_id=productos_creados[0].id, cantidad=Decimal("2")),
                    DetalleVentaCrear(producto_id=productos_creados[1].id, cantidad=Decimal("1")),
                ],
                metodo_pago="efectivo",
                monto_recibido=Decimal("20000"),
            ),
            current_user=admin_user,
            db=db,
        )

        # Venta 2 por Nequi
        v2 = venta_service.registrar_venta(
            empresa_id=empresa_id,
            data=VentaCrear(
                detalles=[
                    DetalleVentaCrear(producto_id=productos_creados[2].id, cantidad=Decimal("1")),
                    DetalleVentaCrear(producto_id=productos_creados[5].id, cantidad=Decimal("1")),
                ],
                metodo_pago="nequi",
                cliente_nombre="Doña Martha Rojas",
            ),
            current_user=admin_user,
            db=db,
        )

        # Egreso menor de caja
        mov_egreso = models.MovimientoCaja(
            sesion_caja_id=sesion_caja.id,
            empresa_id=empresa_id,
            usuario_id=admin_user.id,
            usuario_nombre_snapshot=admin_user.nombre,
            tipo="egreso",
            categoria="pago_proveedor",
            concepto="Pago transporte domiciliario hielo",
            monto=Decimal("4000"),
            metodo_pago="efectivo",
        )
        db.add(mov_egreso)
        db.refresh(sesion_caja)
        sesion_caja.total_egresos = Decimal(str(sesion_caja.total_egresos or 0)) + Decimal("4000")
        sesion_caja.saldo_esperado_efectivo = (
            Decimal(str(sesion_caja.monto_inicial or 0))
            + Decimal(str(sesion_caja.total_ventas_efectivo or 0))
            - sesion_caja.total_egresos
        )
        db.commit()

        print("7. Creando comprobantes QR de demostración...")
        comp1 = models.ComprobantePago(
            empresa_id=empresa_id,
            venta_id=v2.id,
            usuario_id=admin_user.id,
            usuario_nombre_snapshot=admin_user.nombre,
            billetera="Nequi",
            monto=Decimal("25700"),
            referencia_pago="NQ-8841209",
            qr_raw_data="NEQUI|REF:NQ-8841209|MONTO:25700|DEST:3102233445",
            imagen_data=_svg_data_uri("#fdf2f8", "#db2777", "📲", "Comprobante Nequi", "Ref: NQ-8841209 • $25.700"),
            estado_verificacion="VERIFICADO_MANUALMENTE",
            verificado_por_id=admin_user.id,
            notas="Pagador: Doña Martha Rojas | Confirmado en notificación de la app Nequi.",
        )
        comp2 = models.ComprobantePago(
            empresa_id=empresa_id,
            usuario_id=admin_user.id,
            usuario_nombre_snapshot=admin_user.nombre,
            billetera="DaviPlata",
            monto=Decimal("14800"),
            referencia_pago="DP-551904",
            qr_raw_data="DAVIPLATA|REF:DP-551904|MONTO:14800",
            imagen_data=_svg_data_uri("#fef2f2", "#e11d48", "🧾", "Comprobante DaviPlata", "Ref: DP-551904 • $14.800"),
            estado_verificacion="CAPTURADO_NO_VERIFICADO",
            notas="Pagador: Carlos Andrade | Pendiente revisar saldo en DaviPlata al cierre.",
        )
        db.add_all([comp1, comp2])
        db.commit()

        print("\n==============================================================")
        print("[OK] TIENDAPP LISTA PARA USAR")
        print("--------------------------------------------------------------")
        print("URL Aplicación:     http://localhost:5173")
        print("URL API / Swagger:  http://localhost:8000/docs")
        print("Usuario Tendero:    tendero@tiendapp.co     (Clave: Tienda2026!)")
        print("Usuario Cajero:     cajero@tiendapp.co      (Clave: Cajero2026!)")
        print("Usuario SuperAdmin: superadmin@tiendapp.co  (Clave: SuperAdmin2026!)")
        print("==============================================================")
    finally:
        db.close()


if __name__ == "__main__":
    inicializar_demo()
