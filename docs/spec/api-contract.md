# Contrato de API — Módulo POS & Inventarios (Gestión Neiva)

**Base URL:** `/api/v1`  
**Autenticación:** `Authorization: Bearer <JWT>`  
**Formato de Fechas:** ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`)  

---

## 1. Convención de Respuestas de Error (RFC 7807)

```json
{
  "type": "https://api.gestionneiva.com/errors/insufficient-stock",
  "title": "Stock Insuficiente",
  "status": 422,
  "detail": "El producto 'Arroz Roa 1kg' tiene 3 unidades disponibles y se intentó vender 5.",
  "instance": "/api/v1/sales"
}
```

---

## 2. Endpoints Principales

### `POST /api/v1/sales` — Registrar Venta POS
Registra la transacción de venta, congela precios y descuenta inventario de forma atómica.

#### Cabeceras
- `Authorization`: `Bearer <token>` (El token contiene `tenant_id` y `user_id`)

#### Request Body
```json
{
  "medioPago": "efectivo",
  "clienteId": null,
  "items": [
    {
      "productoId": "8f1a3a40-2a8b-4bfa-93e1-3829ad48b812",
      "cantidad": 2
    },
    {
      "productoId": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
      "cantidad": 1
    }
  ]
}
```

#### Respuesta Exitosa (`201 Created`)
```json
{
  "id": "c7a8b9d0-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "fechaVenta": "2026-09-28T23:15:00Z",
  "medioPago": "efectivo",
  "total": 34500.00,
  "items": [
    {
      "productoId": "8f1a3a40-2a8b-4bfa-93e1-3829ad48b812",
      "nombreHistorico": "Arroz Roa 1kg",
      "precioUnitario": 4500.00,
      "cantidad": 2,
      "subtotal": 9000.00
    },
    {
      "productoId": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
      "nombreHistorico": "Aceite Gourmet 1000ml",
      "precioUnitario": 25500.00,
      "cantidad": 1,
      "subtotal": 25500.00
    }
  ]
}
```

#### Códigos de Error
- `400 Bad Request`: `items` vacío o cantidades <= 0.
- `404 Not Found`: Si algún producto no existe o pertenece a otra empresa (`tenant_id`).
- `409 Conflict`: Conflicto de versión / concurrencia en stock.
- `422 Unprocessable Entity`: Stock insuficiente para satisfacer la venta.

---

### `GET /api/v1/products/pos-search` — Búsqueda en Terminal POS
Permite buscar productos en caja por código de barras o término de búsqueda.

#### Query Parameters
- `q`: Término de búsqueda (SKU, código de barras o parte del nombre).

#### Respuesta Exitosa (`200 OK`)
```json
[
  {
    "id": "8f1a3a40-2a8b-4bfa-93e1-3829ad48b812",
    "codigoBarras": "7701234567890",
    "nombre": "Arroz Roa 1kg",
    "precio": 4500.00,
    "stock": 28
  }
]
```
