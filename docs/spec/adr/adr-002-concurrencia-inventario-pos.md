# ADR-002: Control de Concurrencia en Inventarios de Punto de Venta (POS)

- **Estado:** Aceptado  
- **Fecha:** 2026-09-28  
- **Decisores:** Equipo de Ingeniería Gestión Neiva  
- **Rige bajo:** `docs/spec/constitution.md` Artículo VI  

---

## 1. Contexto y Problema

En horas pico en tiendas con múltiples cajas o terminales simultáneos, dos cajeros pueden intentar facturar la última unidad de un producto al mismo instante. Sin un mecanismo de control de concurrencia, ambas transacciones podrían leer `stock = 1`, descontar 1 y dejar el inventario en -1 o vender productos no existentes.

---

## 2. Opciones Evaluadas

### Opción A: Bloqueo pesimista (`SELECT ... FOR UPDATE` en transacción corta)
- **Ventajas:** Garantía inmediata en PostgreSQL; el motor bloquea la fila del producto durante los microsegundos que tarda en insertar la venta y hacer `stock = stock - cantidad`.
- **Desventajas:** Mantiene un bloqueo exclusivo a nivel de fila durante la transacción (aunque sea muy corta).

### Opción B: Concurrencia optimista pura (Token de versión `version INT`)
- **Ventajas:** No bloquea la fila; si la versión cambió en el `UPDATE`, la consulta afecta 0 filas y se dispara una excepción en la app.
- **Desventajas:** Obliga al cajero a reintentar si otro cobró una milésima de segundo antes, lo que puede ser frustrante en la fila de una tienda si el producto aún tenía suficiente stock.

---

## 3. Decisión Adoptada

Se adopta una **estrategia combinada optimizada para POS**:

1. **Bloqueo a nivel de fila con transacción corta (`SELECT ... FOR UPDATE`) ordenado por ID de producto** durante la confirmación final de la venta.
2. Al ordenar el bloqueo de productos alfabéticamente por su UUID, se elimina por completo el riesgo de **deadlocks** (bloqueos mutuos).
3. La transacción se mantiene abierta únicamente durante la lectura del stock, validación de no negatividad (`stock >= cantidad`), descuento del inventario e inserción de la cabecera/detalles de venta.
4. Si el stock no alcanza, se aborta la transacción y se retorna un error claro `422 Unprocessable Entity` especificando qué producto agotó sus existencias.

---

## 4. Consecuencias

### Positivas
- Cero sobreventas ni stock negativo.
- Consistencia inmediata garantizada por PostgreSQL 16 sin obligar a reintentos complejos en el frontend.
- Cero deadlocks gracias al ordenamiento determinista por ID al bloquear múltiples productos en un ticket.
