/**
 * Pruebas Automatizadas de Lógica Frontend (Carrito POS, Cantidades Fraccionarias,
 * Permisos de Rutas SPA y Utilidades Monetarias).
 */

import {
  addProductToCart,
  updateCartItemQty,
  removeCartItem,
  calculateCartTotals,
} from '../js/state.js'
import { isRouteAllowed } from '../js/core/permissions.js'
import { calculateChange, formatCOP } from '../js/utils/money.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Fallo en prueba: ${message}`)
  }
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

console.log('OK: Todas las pruebas de frontend (Carrito, Granel, Cambio y RBAC SPA) pasaron.')
