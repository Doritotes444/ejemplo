import {
  STORES,
  generateId,
  getAllFromStore,
  getById,
  putInStore,
} from '../core/db.js'
import { assertOwnerPermission } from '../core/permissions.js'
import { DEFAULT_TIENDA_ID } from '../core/session.js'
import { validateProductPayload, getTodayISO } from '../utils/validation.js'
import { roundQty } from '../utils/quantities.js'
import { roundMoney } from '../utils/money.js'
import { summarizeProductLots, createLot, listLots } from './lots.js'

/**
 * Servicio de Productos.
 * El stock del producto se deriva dinámicamente de sus lotes disponibles (no vencidos).
 */

export function enrichProductWithLots(producto, productLots = [], referenceDateISO = getTodayISO()) {
  const summary = summarizeProductLots(productLots, referenceDateISO)
  return {
    ...producto,
    cantidad_disponible: summary.cantidad_disponible,
    cantidad_actual: summary.cantidad_disponible, // alias de compatibilidad con el POS
    cantidad_vencida: summary.cantidad_vencida,
    cantidad_total_fisica: summary.cantidad_total_fisica,
    lotes_activos: summary.lotes_activos,
    lotes_vencidos: summary.lotes_vencidos,
    proximo_lote: summary.proximo_lote,
    precio_costo_referencia: summary.precio_costo_referencia,
    lotes: summary.lotes_ordenados,
  }
}

export async function listProductsWithStock(tiendaId = DEFAULT_TIENDA_ID, referenceDateISO = getTodayISO()) {
  const [rawProducts, allLots] = await Promise.all([
    getAllFromStore(STORES.PRODUCTOS, tiendaId),
    listLots(tiendaId),
  ])

  const lotsByProduct = new Map()
  for (const lote of allLots) {
    if (!lotsByProduct.has(lote.producto_id)) {
      lotsByProduct.set(lote.producto_id, [])
    }
    lotsByProduct.get(lote.producto_id).push(lote)
  }

  const activeProducts = rawProducts.filter((p) => p.is_active !== false)
  const enriched = activeProducts.map((p) =>
    enrichProductWithLots(p, lotsByProduct.get(p.id) || [], referenceDateISO)
  )

  return enriched.sort((a, b) => {
    const freqDiff = Number(Boolean(b.es_frecuente)) - Number(Boolean(a.es_frecuente))
    if (freqDiff !== 0) return freqDiff
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
  })
}

export async function findProductByBarcode(codigoBarras, tiendaId = DEFAULT_TIENDA_ID) {
  const clean = String(codigoBarras || '').trim().toLowerCase()
  if (!clean) return null
  const products = await listProductsWithStock(tiendaId)
  return (
    products.find((p) => String(p.codigo_barras || '').trim().toLowerCase() === clean) || null
  )
}

export async function createProduct(payload, user) {
  assertOwnerPermission(user, 'crear productos en el catálogo')

  const validation = validateProductPayload(payload)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const tiendaId = user?.tienda_id || DEFAULT_TIENDA_ID
  const duplicate = await findProductByBarcode(validation.cleaned.codigo_barras, tiendaId)
  if (duplicate) {
    throw new Error(
      `Ya existe un producto con el código "${validation.cleaned.codigo_barras}" (${duplicate.nombre}).`
    )
  }

  const now = new Date().toISOString()
  const productRecord = {
    id: payload.id || generateId('prd'),
    tienda_id: tiendaId,
    nombre: validation.cleaned.nombre,
    codigo_barras: validation.cleaned.codigo_barras,
    categoria: validation.cleaned.categoria,
    unidad_medida: validation.cleaned.unidad_medida,
    precio_venta: validation.cleaned.precio_venta,
    stock_minimo: validation.cleaned.stock_minimo,
    es_frecuente: validation.cleaned.es_frecuente,
    foto_url: validation.cleaned.foto_url,
    is_active: true,
    created_at: now,
    updated_at: now,
  }

  await putInStore(STORES.PRODUCTOS, productRecord)

  // Si en el modal de creación se incluyó un lote inicial, lo creamos automáticamente
  const initialQty = roundQty(payload?.lote_inicial?.cantidad_disponible ?? payload?.cantidad_inicial ?? 0)
  if (initialQty > 0) {
    const codigoLote =
      String(payload?.lote_inicial?.codigo_lote || '').trim() ||
      `L-${getTodayISO().replace(/-/g, '')}-01`
    await createLot(
      {
        producto_id: productRecord.id,
        codigo_lote: codigoLote,
        cantidad_disponible: initialQty,
        costo_unitario: roundMoney(
          payload?.lote_inicial?.costo_unitario ?? payload?.precio_costo ?? 0
        ),
        fecha_entrada: payload?.lote_inicial?.fecha_entrada || getTodayISO(),
        fecha_vencimiento: payload?.lote_inicial?.fecha_vencimiento || null,
        motivo: 'Lote inicial al registrar producto',
      },
      user
    )
  }

  const lots = await listLots(tiendaId, productRecord.id)
  return enrichProductWithLots(productRecord, lots)
}

export async function updateProduct(productId, payload, user) {
  assertOwnerPermission(user, 'editar productos')
  const existing = await getById(STORES.PRODUCTOS, productId)
  if (!existing) {
    throw new Error('Producto no encontrado.')
  }

  const merged = { ...existing, ...payload }
  const validation = validateProductPayload(merged)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const tiendaId = existing.tienda_id || DEFAULT_TIENDA_ID
  const duplicate = await findProductByBarcode(validation.cleaned.codigo_barras, tiendaId)
  if (duplicate && duplicate.id !== productId) {
    throw new Error(
      `El código "${validation.cleaned.codigo_barras}" ya pertenece a "${duplicate.nombre}".`
    )
  }

  const updated = {
    ...existing,
    nombre: validation.cleaned.nombre,
    codigo_barras: validation.cleaned.codigo_barras,
    categoria: validation.cleaned.categoria,
    unidad_medida: validation.cleaned.unidad_medida,
    precio_venta: validation.cleaned.precio_venta,
    stock_minimo: validation.cleaned.stock_minimo,
    es_frecuente: validation.cleaned.es_frecuente,
    foto_url: validation.cleaned.foto_url,
    updated_at: new Date().toISOString(),
  }

  await putInStore(STORES.PRODUCTOS, updated)
  const lots = await listLots(tiendaId, productId)
  return enrichProductWithLots(updated, lots)
}

export async function deactivateProduct(productId, user) {
  assertOwnerPermission(user, 'dar de baja productos')
  const existing = await getById(STORES.PRODUCTOS, productId)
  if (!existing) return false

  const updated = {
    ...existing,
    is_active: false,
    updated_at: new Date().toISOString(),
  }
  await putInStore(STORES.PRODUCTOS, updated)
  return true
}
