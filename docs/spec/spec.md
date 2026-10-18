# Especificación Funcional — Módulo POS & Inventarios (Gestión Neiva)

**Sistema:** Gestión Neiva — POS SaaS Multi-Tenant  
**Módulo:** Punto de Venta (POS), Ventas e Inventario  
**Versión:** 1.0  

---

## 1. Visión del Módulo POS

El módulo de Punto de Venta permite a los cajeros y administradores de tiendas en Neiva registrar ventas de forma ultrarrápida, gestionar medios de pago, emitir comprobantes y mantener el inventario sincronizado en tiempo real, garantizando el aislamiento absoluto de datos entre diferentes empresas suscritas al SaaS.

---

## 2. Historias de Usuario

### HU-POS-01: Registro y Cobro de Venta Rápida
> **Como** cajero de la tienda  
> **Quiero** escanear o buscar productos, agregarlos al carrito y registrar la venta con su medio de pago  
> **Para** cobrarle al cliente de forma ágil y que el inventario se descuente automáticamente sin errores.

#### Criterios de Aceptación
- **CA-01.1:** Si algún producto del carrito no tiene stock suficiente, el sistema cancela la operación atómicamente y devuelve un error descriptivo con el producto y la cantidad disponible (`422 Unprocessable Entity`).
- **CA-01.2:** Cada producto vendido almacena en la línea de venta el precio unitario y el nombre exacto que tenía al momento de la transacción (Snapshot inmutable).
- **CA-01.3:** La venta se asocia automáticamente al `tenant_id` y al `user_id` del usuario autenticado en el token JWT.
- **CA-01.4:** El stock del producto se reduce en exactamente la cantidad vendida.

### HU-POS-02: Consulta de Catálogo para el Terminal POS
> **Como** cajero de la tienda  
> **Quiero** buscar productos por código de barras o texto y ver su precio y stock actual  
> **Para** armar el ticket de venta en el terminal.

#### Criterios de Aceptación
- **CA-02.1:** Solo se listan productos pertenecientes a la empresa del cajero (`tenant_id`).
- **CA-02.2:** Solo se muestran productos con `is_active = True`.
- **CA-02.3:** La respuesta incluye SKU, nombre, precio de venta y existencias disponibles.

---

## 3. Catálogo de Reglas de Negocio (RN)

| Código | Nombre de la Regla | Descripción | Severidad |
|---|---|---|---|
| `RN-01` | **No negatividad de stock** | Ninguna venta puede provocar que el stock de un producto sea menor a 0. | Bloqueante |
| `RN-02` | **Inmutabilidad de precios** | El precio registrado en la línea de venta jamás se actualiza, incluso si el catálogo cambia de precio posteriormente. | Bloqueante |
| `RN-03` | **Aislamiento Multi-Tenant** | Es imposible vender, descontar stock o consultar productos pertenecientes a otra empresa. | Bloqueante |
| `RN-04` | **Transaccionalidad Atómica** | La venta y el descuento de inventario ocurren en la misma transacción de base de datos; si una línea falla, se revierte todo. | Bloqueante |
| `RN-05` | **Baja lógica de productos** | Un producto con ventas históricas no puede borrarse físicamente; solo se marca `is_active = False`. | Bloqueante |
| `RN-06` | **Totales derivados** | El total de la venta es la suma de `(quantity * unit_price)` de sus líneas; no se almacena como dato estático redundante. | Bloqueante |
