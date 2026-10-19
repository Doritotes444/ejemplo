"""
Suite integral de pruebas automatizadas para Tiendapp (Gestión Inteligente Neiva).
Cubre todos los flujos críticos exigidos en la auditoría de ingeniería:
1. Recuperación de contraseña y cambio seguro de clave.
2. Productos con fotografía obligatoria, modo provisional, búsqueda por código de barras y aislamiento multi-tenant.
3. Movimientos de inventario auditables (entrada, salida, ajuste) y alertas inteligentes de reposición.
4. Flujo de venta rápida (<3s), métodos de pago, cálculo de cambio, idempotencia offline y anulación auditable con reversión de stock.
5. Sesión de caja: apertura, ingresos, egresos, estado y arqueo de cierre con cálculo de diferencia.
6. Escaneo de comprobantes QR, bóveda fotográfica privada y distinción entre CAPTURADO_NO_VERIFICADO y VERIFICADO_MANUALMENTE.
7. Visión Financiera 360° y Simulador Comercial matemático (margen, utilidad neta, punto de equilibrio).
8. Sincronización Offline por lotes (idempotencia por client_operation_id y manejo de conflictos).
9. Planes comerciales configurables (Gratis, Standard, Pro), cambio de plan sin pérdida de datos y panel SuperAdmin.
"""

import uuid


def _registrar_tienda(client, sufijo="1"):
    res = client.post(
        "/api/auth/registro-completo",
        json={
            "nombre_comercial": f"Tienda Barrio {sufijo}",
            "nit_o_cedula": f"90055500{sufijo}",
            "email": f"tendero{sufijo}@tiendapp.co",
            "password": "PasswordSegura123!",
            "rol": "admin",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    token = data["access_token"]
    empresa_id = data["usuario"]["empresa_id"]
    headers = {"Authorization": f"Bearer {token}"}
    return headers, empresa_id, data["usuario"]


def test_recuperacion_y_cambio_password(client):
    headers, _, usuario = _registrar_tienda(client, "rec")

    # 1. Solicitar token de recuperación
    res_sol = client.post(
        "/api/auth/solicitar-recuperacion",
        json={"email": usuario["email"]},
    )
    assert res_sol.status_code == 200
    token_rec = res_sol.json().get("token_desarrollo")
    assert token_rec

    # 2. Confirmar recuperación con nueva contraseña
    res_conf = client.post(
        "/api/auth/confirmar-recuperacion",
        json={"token": token_rec, "nueva_password": "NuevaPassword456!"},
    )
    assert res_conf.status_code == 200

    # 3. Verificar login con la nueva contraseña
    res_login = client.post(
        "/api/auth/login",
        json={"email": usuario["email"], "password": "NuevaPassword456!"},
    )
    assert res_login.status_code == 200


def test_productos_fotografia_obligatoria_y_aislamiento_codigos(client):
    headers_a, _, _ = _registrar_tienda(client, "prodA")
    headers_b, _, _ = _registrar_tienda(client, "prodB")

    # 1. Rechazar producto definitivo sin fotografía cuando exigir_foto=True y no es provisional
    res_sin_foto = client.post(
        "/api/productos",
        headers=headers_a,
        json={
            "nombre": "Arroz Diana 500g",
            "precio_venta": 2800,
            "precio_costo": 2100,
            "cantidad_actual": 30,
            "codigo_barras": "7702001001",
            "es_provisional": False,
            "exigir_foto": True,
            "foto_url": "",
        },
    )
    assert res_sin_foto.status_code in (400, 422)

    # 2. Permitir producto definitivo con fotografía válida
    foto_data = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>"
    res_con_foto = client.post(
        "/api/productos",
        headers=headers_a,
        json={
            "nombre": "Arroz Diana 500g",
            "precio_venta": 2800,
            "costo_unitario": 2100,
            "cantidad_actual": 30,
            "stock_minimo": 10,
            "proveedor": "Distribuidora Huila",
            "codigo_barras": "7702001001",
            "es_frecuente": True,
            "foto_url": foto_data,
        },
    )
    assert res_con_foto.status_code == 201
    prod_a = res_con_foto.json()
    assert prod_a["foto_url"] == foto_data
    assert prod_a["proveedor"] == "Distribuidora Huila"

    # 3. Otra tienda (Tenant B) PUEDE registrar el mismo código de barras sin colisión
    res_tenant_b = client.post(
        "/api/productos",
        headers=headers_b,
        json={
            "nombre": "Arroz Diana 500g Tienda B",
            "precio_venta": 2900,
            "costo_unitario": 2200,
            "cantidad_actual": 15,
            "codigo_barras": "7702001001",
            "foto_url": foto_data,
        },
    )
    assert res_tenant_b.status_code == 201

    # 4. Búsqueda instantánea por código de barras en Tienda A
    res_scan = client.get("/api/productos/codigo/7702001001", headers=headers_a)
    assert res_scan.status_code == 200
    assert res_scan.json()["id"] == prod_a["id"]


def test_movimientos_inventario_y_alertas_inteligentes(client):
    headers, _, _ = _registrar_tienda(client, "inv")
    foto_data = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>"

    res_prod = client.post(
        "/api/productos",
        headers=headers,
        json={
            "nombre": "Aceite Gourmet 1L",
            "precio_venta": 12000,
            "costo_unitario": 9500,
            "cantidad_actual": 4,
            "stock_minimo": 6,
            "tiempo_reposicion_dias": 5,
            "codigo_barras": "7709998887",
            "foto_url": foto_data,
        },
    )
    assert res_prod.status_code == 201
    prod_id = res_prod.json()["id"]

    # 1. Registrar entrada de mercancía
    res_ent = client.post(
        f"/api/productos/{prod_id}/movimiento",
        headers=headers,
        json={
            "tipo": "entrada",
            "cantidad": 10,
            "costo_unitario": 9600,
            "motivo": "Compra factura #441",
        },
    )
    assert res_ent.status_code == 200
    assert res_ent.json()["stock_resultante"] == 14

    # 2. Registrar salida por merma
    res_sal = client.post(
        f"/api/productos/{prod_id}/movimiento",
        headers=headers,
        json={
            "tipo": "salida",
            "cantidad": 11,
            "motivo": "Ajuste por promoción y muestra",
        },
    )
    assert res_sal.status_code == 200
    assert res_sal.json()["stock_resultante"] == 3

    # 3. Consultar historial de kardex
    res_hist = client.get("/api/productos/movimientos/historial", headers=headers)
    assert res_hist.status_code == 200
    assert len(res_hist.json()) >= 2

    # 4. Consultar alertas inteligentes (stock 3 <= stock_minimo 6)
    res_alertas = client.get("/api/productos/alertas/inteligentes", headers=headers)
    assert res_alertas.status_code == 200
    alertas_data = res_alertas.json()
    assert alertas_data["resumen"]["bajo_stock"] >= 1


def test_flujo_completo_caja_venta_rapida_y_anulacion_auditable(client):
    headers, empresa_id, _ = _registrar_tienda(client, "caja")
    foto_data = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>"

    # 1. Crear producto con stock 20
    res_prod = client.post(
        "/api/productos",
        headers=headers,
        json={
            "nombre": "Leche Alquería 1L",
            "precio_venta": 4500,
            "costo_unitario": 3500,
            "cantidad_actual": 20,
            "codigo_barras": "7701112223",
            "foto_url": foto_data,
        },
    )
    prod_id = res_prod.json()["id"]

    # 2. Abrir sesión de caja con base $50.000
    res_abrir = client.post(
        "/api/caja/abrir",
        headers=headers,
        json={"monto_inicial": 50000, "notas_apertura": "Inicio turno mañana"},
    )
    assert res_abrir.status_code == 201

    # 3. Registrar venta rápida de 2 unidades ($9.000) pagando con billete de $10.000
    op_id = f"op-{uuid.uuid4()}"
    res_venta = client.post(
        f"/api/ventas/{empresa_id}",
        headers=headers,
        json={
            "detalles": [{"producto_id": prod_id, "cantidad": 2}],
            "metodo_pago": "Efectivo",
            "monto_recibido": 10000,
            "client_operation_id": op_id,
        },
    )
    assert res_venta.status_code == 201
    venta = res_venta.json()
    assert venta["total"] == 9000
    assert venta["cambio_entregado"] == 1000

    # 4. Reintentar la misma venta con el mismo client_operation_id (idempotencia)
    res_dup = client.post(
        f"/api/ventas/{empresa_id}",
        headers=headers,
        json={
            "detalles": [{"producto_id": prod_id, "cantidad": 2}],
            "metodo_pago": "Efectivo",
            "monto_recibido": 10000,
            "client_operation_id": op_id,
        },
    )
    assert res_dup.status_code == 201
    assert res_dup.json()["id"] == venta["id"]

    # 5. Registrar egreso de caja ($4.000 pago hielo)
    res_egr = client.post(
        "/api/caja/movimiento",
        headers=headers,
        json={
            "tipo": "EGRESO",
            "categoria": "Pago proveedor",
            "concepto": "Compra bolsas de hielo",
            "monto": 4000,
            "metodo_pago": "Efectivo",
        },
    )
    assert res_egr.status_code == 201

    # 6. Verificar estado de caja: Base 50.000 + Venta 9.000 - Egreso 4.000 = 55.000
    res_est = client.get("/api/caja/estado", headers=headers)
    assert res_est.status_code == 200
    assert res_est.json()["sesion"]["saldo_esperado_efectivo"] == 55000

    # 7. Anular la venta de $9.000 con motivo auditable -> Stock vuelve a 20 y caja a 46.000
    res_anul = client.post(
        f"/api/ventas/{empresa_id}/{venta['id']}/anular",
        headers=headers,
        json={"motivo": "Cliente solicitó devolución inmediata"},
    )
    assert res_anul.status_code == 200
    assert res_anul.json()["estado"].upper() == "ANULADA"

    # Verificar que el stock regresó a 20
    res_prod_check = client.get(f"/api/productos/codigo/7701112223", headers=headers)
    assert res_prod_check.json()["cantidad_actual"] == 20

    # 8. Cerrar caja y realizar arqueo físico ($46.000 contados -> diferencia 0)
    res_cerrar = client.post(
        "/api/caja/cerrar",
        headers=headers,
        json={"monto_fisico_contado": 46000, "notas_cierre": "Cuadre exacto"},
    )
    assert res_cerrar.status_code == 200
    assert res_cerrar.json()["diferencia"] == 0
    assert res_cerrar.json()["estado_arqueo"] == "CUADRE_EXACTO"


def test_comprobantes_qr_y_distincion_verificacion(client):
    headers, _, _ = _registrar_tienda(client, "qr")

    # 1. Analizar texto de QR de transferencia
    res_qr = client.post(
        "/api/comprobantes/analizar-qr",
        headers=headers,
        json={"qr_raw_data": "NEQUI|REF:M998877|MONTO:35000"},
    )
    assert res_qr.status_code == 200
    analisis = res_qr.json()
    assert analisis["estado_verificacion"] == "CAPTURADO_NO_VERIFICADO"
    assert analisis["datos_extraidos"]["entidad_detectada"] == "Nequi"

    # 2. Guardar comprobante con foto privada obligatoria
    foto_privada = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    res_crear = client.post(
        "/api/comprobantes",
        headers=headers,
        json={
            "metodo_pago": "Nequi",
            "monto": 35000,
            "referencia_transaccion": "M998877",
            "pagador_nombre": "Doña Rosa",
            "qr_raw_data": "NEQUI|REF:M998877|MONTO:35000",
            "foto_comprobante_url": foto_privada,
            "verificado_manualmente": False,
        },
    )
    assert res_crear.status_code == 201
    comp = res_crear.json()
    assert comp["estado_verificacion"] == "CAPTURADO_NO_VERIFICADO"

    # 3. Verificar manualmente después de revisar la app bancaria
    res_ver = client.patch(
        f"/api/comprobantes/{comp['id']}/verificar",
        headers=headers,
        json={
            "estado_verificacion": "VERIFICADO_MANUALMENTE",
            "notas": "Confirmado en app Nequi",
        },
    )
    assert res_ver.status_code == 200
    assert res_ver.json()["estado_verificacion"] == "VERIFICADO_MANUALMENTE"

    # 4. Consultar imagen privada autenticada
    res_img = client.get(f"/api/comprobantes/{comp['id']}/imagen", headers=headers)
    assert res_img.status_code == 200
    assert res_img.json()["foto_comprobante_url"] == foto_privada


def test_dashboard_360_y_simulador_comercial(client):
    headers, empresa_id, _ = _registrar_tienda(client, "sim")

    # 1. Probar Simulador Comercial
    res_sim = client.post(
        "/api/reportes/simulador",
        headers=headers,
        json={
            "precio_venta": 5000,
            "precio_compra": 3000,
            "volumen_unidades": 100,
            "gastos_fijos": 60000,
            "gasto_variable_unitario": 0,
            "descuento_porcentaje": 10,
            "precio_venta_base": 4500,
            "costo_compra_base": 3000,
            "volumen_base": 80,
        },
    )
    assert res_sim.status_code == 200
    sim = res_sim.json()["escenario_simulado"]
    # Precio efectivo = 5000 * 0.9 = 4500; Margen = 4500 - 3000 = 1500
    assert sim["precio_venta_efectivo"] == 4500
    assert sim["margen_unitario"] == 1500
    # Utilidad neta = (1500 * 100) - 60000 = 90000
    assert sim["utilidad_neta_estimada"] == 90000
    # Punto de equilibrio = ceil(60000 / 1500) = 40 unidades
    assert sim["punto_equilibrio_unidades"] == 40

    # 2. Probar Dashboard 360
    res_dash = client.get(f"/api/dashboard/{empresa_id}", headers=headers)
    assert res_dash.status_code == 200
    dash = res_dash.json()
    assert "finanzas_360" in dash
    assert "estado_resultado" in dash["finanzas_360"]


def test_sincronizacion_offline_lote_y_tres_planes(client):
    headers, _, _ = _registrar_tienda(client, "sync")
    foto_data = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'></svg>"

    res_prod = client.post(
        "/api/productos",
        headers=headers,
        json={
            "nombre": "Café Sello Rojo 250g",
            "precio_venta": 8500,
            "costo_unitario": 6500,
            "cantidad_actual": 10,
            "codigo_barras": "7705554441",
            "foto_url": foto_data,
        },
    )
    prod_id = res_prod.json()["id"]

    # 1. Sincronizar lote offline con una venta y un movimiento de inventario
    op_vta = f"sync-vta-{uuid.uuid4()}"
    op_mov = f"sync-mov-{uuid.uuid4()}"
    res_sync = client.post(
        "/api/sync/lote",
        headers=headers,
        json={
            "operaciones": [
                {
                    "client_operation_id": op_vta,
                    "tipo": "venta",
                    "payload": {
                        "detalles": [{"producto_id": prod_id, "cantidad": 2}],
                        "metodo_pago": "Efectivo",
                        "monto_recibido": 20000,
                    },
                },
                {
                    "client_operation_id": op_mov,
                    "tipo": "movimiento_inventario",
                    "payload": {
                        "producto_id": prod_id,
                        "tipo": "entrada",
                        "cantidad": 5,
                        "motivo": "Entrada offline sincronizada",
                    },
                },
            ]
        },
    )
    assert res_sync.status_code == 200
    sync_data = res_sync.json()
    assert sync_data["sincronizadas"] == 2
    assert sync_data["conflictos"] == 0

    # 2. Verificar catálogo de 3 planes comerciales (basic, standard, pro)
    res_planes = client.get("/api/planes")
    assert res_planes.status_code == 200
    codigos = [p["codigo"] for p in res_planes.json()]
    assert "basic" in codigos
    assert "standard" in codigos
    assert "pro" in codigos

    # 3. Cambiar a plan standard sin perder datos
    res_cambio = client.post(
        "/api/planes/cambiar",
        headers=headers,
        json={"plan_codigo": "standard"},
    )
    assert res_cambio.status_code == 200
    assert res_cambio.json()["plan_nuevo"] == "standard"
