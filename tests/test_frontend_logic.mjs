/**
 * Pruebas Automatizadas de Lógica Frontend:
 * - Semilla de 400 Productos en COP e imágenes vía URL remota (db.js)
 * - Carrito POS, Cantidades Fraccionarias, Cambio y Permisos RBAC
 * - Métricas Rápidas del Dueño y Ordenamiento FEFO/FIFO de Lotes
 */

import {
  addProductToCart,
  updateCartItemQty,
  removeCartItem,
  calculateCartTotals,
} from '../js/state.js'
import { isRouteAllowed } from '../js/core/permissions.js'
import { calculateChange, formatCOP } from '../js/utils/money.js'
import { SEED_PRODUCTS, SEED_CATEGORIES } from '../js/data/db.js'
import { computeOwnerQuickMetrics, sortSellableLotsFEFO } from '../js/core/localStore.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Fallo en prueba: ${message}`)
  }
}

// 0. Verificación de la Base de Datos Semilla (400 Productos Reales en COP)
assert(SEED_PRODUCTS.length === 400, `Se esperaban 400 productos, se encontraron ${SEED_PRODUCTS.length}`)
assert(SEED_CATEGORIES.length === 3, 'Existen las 3 categorías principales (Abarrotes, Víveres, Papelería)')
for (const p of SEED_PRODUCTS) {
  assert(Number(p.sale_price) >= 400, `Precio COP válido para ${p.name}`)
  assert(String(p.image_url).startsWith('https://'), `URL remota de imagen para ${p.name}`)
  assert(String(p.barcode).startsWith('770'), `Código EAN-13 colombiano para ${p.name}`)
}

const sampleProduct = {
  id: 'prd_01',
  sku: 'ARR-500',
  name: 'Arroz Premium 500g',
  unit: 'und',
  sale_price: 3200,
  available_stock: 3,
  is_active: true,
}

// 1. Adición al carrito y respeto estricto de stock disponible
let res = addProductToCart([], sampleProduct, 2)
assert(res.ok === true, 'Permite agregar 2 unidades')
assert(res.cart[0].quantity === 2, 'Cantidad en carrito es 2')

res = addProductToCart(res.cart, sampleProduct, 2)
assert(res.ok === false, 'Rechaza superar las 3 unidades disponibles')
assert(res.cart[0].quantity === 3, 'Se ajusta al máximo disponible (3)')

const totals = calculateCartTotals(res.cart)
assert(totals.total === 9600, 'Total calculado correctamente (3 * 3200 = 9600)')
assert(calculateChange(10000, totals.total) === 400, 'Cálculo de cambio exacto ($400)')
assert(formatCOP(9600).includes('9.600'), 'Formato COP válido')

// 2. Cantidades a granel (kg)
const bulkProduct = {
  id: 'prd_02',
  sku: 'QUE-KG',
  name: 'Queso Fresco',
  unit: 'kg',
  sale_price: 20000,
  available_stock: 5.5,
  is_active: true,
}

let bulkRes = addProductToCart([], bulkProduct, 0.75)
assert(bulkRes.ok === true && bulkRes.cart[0].quantity === 0.75, 'Soporta 0.75 kg')
const updatedBulk = updateCartItemQty(bulkRes.cart, 'prd_02', 1.25)
assert(updatedBulk[0].quantity === 1.25, 'Actualiza a 1.25 kg')
const afterRemove = removeCartItem(updatedBulk, 'prd_02')
assert(afterRemove.length === 0, 'Elimina línea del carrito')

// 3. Control de rutas por rol en el cliente
const tenderoUser = { id: 'u1', role: 'tendero' }
const duenoUser = { id: 'u2', role: 'dueno' }

assert(isRouteAllowed(tenderoUser, 'pos') === true, 'Tendero puede acceder a POS')
assert(isRouteAllowed(tenderoUser, 'products') === false, 'Tendero NO puede acceder a productos')
assert(isRouteAllowed(tenderoUser, 'lots') === false, 'Tendero NO puede acceder a lotes')
assert(isRouteAllowed(tenderoUser, 'users') === false, 'Tendero NO puede acceder a usuarios')
assert(isRouteAllowed(duenoUser, 'users') === true, 'Dueño puede acceder a usuarios')
assert(isRouteAllowed(duenoUser, 'lots') === true, 'Dueño puede acceder a lotes')

// 4. Ordenamiento FEFO / FIFO y Métricas Rápidas del Dueño
const sortedLots = sortSellableLotsFEFO(
  [
    { id: 'l1', available_quantity: 5, entry_date: '2026-10-01', expiration_date: '2027-08-01' },
    { id: 'l2', available_quantity: 5, entry_date: '2026-10-15', expiration_date: '2027-02-01' },
    { id: 'l3', available_quantity: 5, entry_date: '2025-01-01', expiration_date: '2025-06-01' }, // Vencido
  ],
  '2026-11-14'
)
assert(sortedLots.length === 2, 'Excluye lotes vencidos')
assert(sortedLots[0].id === 'l2', 'Prioriza FEFO (vence primero l2)')

const metrics = computeOwnerQuickMetrics(SEED_PRODUCTS, [])
assert(metrics.low_stock_count > 0, 'Detecta productos con alerta de bajo stock en el catálogo semilla')

console.log('OK: Todas las pruebas de frontend (400 Productos COP, Carrito, FEFO/FIFO, Métricas Rápidas y RBAC) pasaron.')
