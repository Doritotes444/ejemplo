/**
 * js/core/localStore.js — Motor de Persistencia Local (IndexedDB + LocalStorage)
 * Gestiona Onboarding de Tienda (NIT, Dueño, Documento, Local, Dirección, Barrio),
 * Semilla de 400 productos reales (Abarrotes, Víveres y Papelería), Lotes FEFO/FIFO,
 * Ventas con evidencia fotográfica de transferencia (<canvas> + timestamp) y Métricas Rápidas.
 */

import { SEED_CATEGORIES, SEED_PRODUCTS } from '../data/db.js'

const IDB_NAME = 'kairo_pos_idb_v3'
const IDB_VERSION = 1

export const LS_KEYS = {
  STORE_PROFILE: 'kairo_store_profile_v3',
  ACTIVE_SESSION: 'kairo_active_session_v3',
  FAKESTORE_CACHE: 'kairo_fakestore_imgs_v3',
}

let dbPromise = null

function getTodayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function openLocalDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result
      const stores = [
        'store_profile',
        'users',
        'categories',
        'products',
        'lots',
        'sales',
        'movements',
      ]
      for (const name of stores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }

    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })

  return dbPromise
}

async function getAllFromStore(storeName) {
  const db = await openLocalDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

async function putInStore(storeName, record) {
  const db = await openLocalDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(record)
    req.onsuccess = () => resolve(record)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Conecta opcionalmente con FakeStore API para obtener imágenes remotas reales
 * complementarias al generador dinámico por categoría (Picsum).
 */
export async function fetchPublicApiImages() {
  try {
    const cached = localStorage.getItem(LS_KEYS.FAKESTORE_CACHE)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch('https://fakestoreapi.com/products?limit=20', {
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return []
    const data = await res.json()
    const urls = data.map((item) => item.image).filter(Boolean)
    if (urls.length > 0) {
      localStorage.setItem(LS_KEYS.FAKESTORE_CACHE, JSON.stringify(urls))
    }
    return urls
  } catch {
    return []
  }
}

/**
 * Verifica si la tienda ya fue registrada en LocalStorage / IndexedDB
 */
export function getStoredProfileSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.STORE_PROFILE)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getActiveSessionSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.ACTIVE_SESSION)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setActiveSessionSync(user) {
  if (!user) {
    localStorage.removeItem(LS_KEYS.ACTIVE_SESSION)
  } else {
    localStorage.setItem(LS_KEYS.ACTIVE_SESSION, JSON.stringify(user))
  }
}

/**
 * Siembra los 400 productos reales y sus lotes iniciales en IndexedDB si aún no existen
 */
export async function ensureSeed400Products() {
  const existingProducts = await getAllFromStore('products')
  if (existingProducts.length >= 400) {
    return existingProducts.length
  }

  const db = await openLocalDB()
  const nowISO = new Date().toISOString()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['categories', 'products', 'lots', 'movements'], 'readwrite')
    const catStore = tx.objectStore('categories')
    const prodStore = tx.objectStore('products')
    const lotStore = tx.objectStore('lots')
    const movStore = tx.objectStore('movements')

    for (const cat of SEED_CATEGORIES) {
      catStore.put({
        id: String(cat.id),
        name: cat.name,
        description: cat.description || '',
        created_at: nowISO,
      })
    }

    for (const p of SEED_PRODUCTS) {
      const lotId = `lot-${p.id}`
      const initLot = p.initial_lot || {
        lot_number: `L-2026-${p.sku}`,
        quantity: p.available_stock || 20,
        unit_cost: p.unit_cost || Math.round(p.sale_price * 0.7),
        entry_date: '2026-11-01',
        expiration_date: null,
      }

      prodStore.put({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        category_id: String(p.category_id),
        category_name: p.category_name,
        unit: p.unit || 'und',
        sale_price: Number(p.sale_price),
        unit_cost: Number(p.unit_cost || initLot.unit_cost),
        min_stock: Number(p.min_stock ?? 6),
        is_active: true,
        image_url: p.image_url,
        created_at: nowISO,
        updated_at: nowISO,
      })

      lotStore.put({
        id: lotId,
        product_id: p.id,
        lot_number: initLot.lot_number,
        initial_quantity: Number(initLot.quantity),
        available_quantity: Number(initLot.quantity),
        unit_cost: Number(initLot.unit_cost),
        entry_date: initLot.entry_date || '2026-11-01',
        expiration_date: initLot.expiration_date || null,
        notes: 'Lote inicial semilla (Catálogo 400 productos)',
        created_at: nowISO,
      })
    }

    movStore.put({
      id: 'mov-seed-initial',
      product_id: SEED_PRODUCTS[0].id,
      product_name: 'Catálogo Inicial (400 productos)',
      product_sku: 'SEED-400',
      product_unit: 'und',
      lot_id: `lot-${SEED_PRODUCTS[0].id}`,
      lot_number: 'L-2026-APERTURA',
      movement_type: 'ENTRADA',
      quantity: 400,
      previous_stock: 0,
      new_stock: 400,
      reason: 'Carga automática de 400 productos reales (Abarrotes, Víveres y Papelería)',
      user_name: 'Sistema Onboarding',
      created_at: nowISO,
    })

    tx.oncomplete = () => resolve(SEED_PRODUCTS.length)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Registra la tienda en el Onboarding (NIT, Nombre del dueño, Documento, Nombre del local, Dirección, Barrio)
 * y crea las cuentas operativas de Dueño y Tendero.
 */
export async function registerStoreOnboarding(payload) {
  const nit = String(payload.nit || '').trim()
  const owner_name = String(payload.owner_name || '').trim()
  const owner_document = String(payload.owner_document || '').trim()
  const store_name = String(payload.store_name || '').trim()
  const address = String(payload.address || '').trim()
  const neighborhood = String(payload.neighborhood || '').trim()
  const username = String(payload.username || 'dueno').trim().toLowerCase()
  const password = String(payload.password || 'Password2026!')

  if (!nit || !owner_name || !owner_document || !store_name || !address || !neighborhood) {
    throw new Error(
      'Todos los datos del establecimiento son obligatorios: NIT, Nombre del dueño, Documento de identidad, Nombre del local, Dirección y Barrio.'
    )
  }

  const nowISO = new Date().toISOString()
  const profile = {
    id: 'main_store',
    nit,
    owner_name,
    owner_document,
    store_name,
    address,
    neighborhood,
    registered_at: nowISO,
  }

  const ownerUser = {
    id: 'usr-dueno-1',
    username,
    full_name: owner_name,
    document_id: owner_document,
    role: 'dueno',
    role_name: 'Dueño',
    password,
    is_active: true,
    created_at: nowISO,
  }

  const tenderoUser = {
    id: 'usr-tendero-1',
    username: 'tendero',
    full_name: 'Operador de Caja (Tendero)',
    document_id: '1000000001',
    role: 'tendero',
    role_name: 'Tendero',
    password: 'Tendero2026!',
    is_active: true,
    created_at: nowISO,
  }

  await putInStore('store_profile', profile)
  await putInStore('users', ownerUser)
  await putInStore('users', tenderoUser)

  localStorage.setItem(LS_KEYS.STORE_PROFILE, JSON.stringify(profile))
  await ensureSeed400Products()

  const sessionUser = {
    id: ownerUser.id,
    username: ownerUser.username,
    full_name: ownerUser.full_name,
    document_id: ownerUser.document_id,
    role: ownerUser.role,
    role_name: ownerUser.role_name,
    store: profile,
  }
  setActiveSessionSync(sessionUser)
  return { profile, user: sessionUser }
}

/**
 * Calcula el estado de un lote según fecha de vencimiento y cantidad
 */
export function computeLotStatus(lot, todayISO = getTodayISO()) {
  const avail = Number(lot.available_quantity || 0)
  if (avail <= 0) {
    return { status: 'AGOTADO', days_to_expire: null, is_sellable: false }
  }
  if (!lot.expiration_date) {
    return { status: 'DISPONIBLE', days_to_expire: null, is_sellable: true }
  }
  const todayMs = new Date(`${todayISO}T00:00:00`).getTime()
  const expMs = new Date(`${lot.expiration_date}T00:00:00`).getTime()
  const diffDays = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { status: 'VENCIDO', days_to_expire: diffDays, is_sellable: false }
  }
  if (diffDays <= 7) {
    return { status: 'PROXIMO_A_VENCER', days_to_expire: diffDays, is_sellable: true }
  }
  return { status: 'DISPONIBLE', days_to_expire: diffDays, is_sellable: true }
}

/**
 * Ordenamiento FEFO (primero el que vence antes) + FIFO (primero el que ingresó antes)
 */
export function sortSellableLotsFEFO(lots, todayISO = getTodayISO()) {
  return lots
    .map((l) => ({ ...l, ...computeLotStatus(l, todayISO) }))
    .filter((l) => l.is_sellable && Number(l.available_quantity) > 0)
    .sort((a, b) => {
      const aHasExp = Boolean(a.expiration_date)
      const bHasExp = Boolean(b.expiration_date)
      if (aHasExp && !bHasExp) return -1
      if (!aHasExp && bHasExp) return 1
      if (aHasExp && bHasExp && a.expiration_date !== b.expiration_date) {
        return a.expiration_date.localeCompare(b.expiration_date)
      }
      if (a.entry_date !== b.entry_date) {
        return String(a.entry_date || '').localeCompare(String(b.entry_date || ''))
      }
      return String(a.id).localeCompare(String(b.id))
    })
}

/**
 * Obtiene catálogo completo con existencias calculadas en tiempo real desde los lotes
 */
export async function getCatalogWithStock() {
  await ensureSeed400Products()
  const [categories, products, lots] = await Promise.all([
    getAllFromStore('categories'),
    getAllFromStore('products'),
    getAllFromStore('lots'),
  ])

  const today = getTodayISO()
  const catMap = new Map(categories.map((c) => [String(c.id), c.name]))
  const lotsByProd = new Map()

  for (const l of lots) {
    const arr = lotsByProd.get(l.product_id) || []
    arr.push(l)
    lotsByProd.set(l.product_id, arr)
  }

  const enrichedProducts = products.map((p) => {
    const prodLots = lotsByProd.get(p.id) || []
    const sellable = sortSellableLotsFEFO(prodLots, today)
    const available_stock = Number(
      sellable.reduce((acc, l) => acc + Number(l.available_quantity || 0), 0).toFixed(3)
    )
    const expired_stock = Number(
      prodLots
        .filter((l) => computeLotStatus(l, today).status === 'VENCIDO')
        .reduce((acc, l) => acc + Number(l.available_quantity || 0), 0)
        .toFixed(3)
    )
    const nextLot = sellable[0] || null

    return {
      ...p,
      category_name: catMap.get(String(p.category_id)) || p.category_name || 'General',
      available_stock,
      expired_stock,
      active_lots_count: sellable.length,
      next_lot_number: nextLot ? nextLot.lot_number : null,
      next_expiration: nextLot ? nextLot.expiration_date : null,
      is_low_stock: available_stock <= Number(p.min_stock ?? 5),
    }
  })

  return {
    categories,
    products: enrichedProducts,
  }
}

export async function getEnrichedLots() {
  const [products, lots] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('lots'),
  ])
  const prodMap = new Map(products.map((p) => [p.id, p]))
  const today = getTodayISO()

  return lots
    .map((l) => {
      const p = prodMap.get(l.product_id) || {}
      const st = computeLotStatus(l, today)
      return {
        ...l,
        product_name: p.name || 'Producto',
        product_sku: p.sku || '—',
        product_unit: p.unit || 'und',
        status: st.status,
        days_to_expire: st.days_to_expire,
        is_sellable: st.is_sellable,
      }
    })
    .sort((a, b) => {
      const aExp = a.expiration_date || '9999-12-31'
      const bExp = b.expiration_date || '9999-12-31'
      return aExp.localeCompare(bExp)
    })
}

export async function getInventoryMovements() {
  const movs = await getAllFromStore('movements')
  return movs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

/**
 * Registra una venta descontando por método FEFO/FIFO y almacenando la foto de verificación
 * de transferencia (<canvas> + fecha y hora exacta timestamp).
 */
export async function createLocalSale(payload, currentUser) {
  const itemsReq = payload.items || []
  if (itemsReq.length === 0) {
    throw new Error('El ticket de venta está vacío.')
  }

  const [products, lots, existingSales] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('lots'),
    getAllFromStore('sales'),
  ])

  const today = getTodayISO()
  const nowISO = new Date().toISOString()
  const prodMap = new Map(products.map((p) => [p.id, p]))

  let total = 0
  const saleItems = []
  const lotsToUpdate = []
  const movementsToCreate = []

  for (const line of itemsReq) {
    const p = prodMap.get(line.product_id)
    if (!p || !p.is_active) {
      throw new Error('Uno de los productos seleccionados no está activo.')
    }
    const qtyNeeded = Number(line.quantity)
    if (!Number.isFinite(qtyNeeded) || qtyNeeded <= 0) {
      throw new Error(`Cantidad inválida para ${p.name}.`)
    }

    const prodLots = lots.filter((l) => l.product_id === p.id)
    const sellableLots = sortSellableLotsFEFO(prodLots, today)
    const totalAvail = sellableLots.reduce((s, l) => s + Number(l.available_quantity), 0)

    if (qtyNeeded > totalAvail + 1e-6) {
      throw new Error(
        `Stock insuficiente para "${p.name}". Disponible: ${totalAvail} ${p.unit}.`
      )
    }

    let remaining = qtyNeeded
    const allocations = []

    for (const lot of sellableLots) {
      if (remaining <= 0) break
      const avail = Number(lot.available_quantity)
      const take = Number(Math.min(avail, remaining).toFixed(3))
      if (take <= 0) continue

      const newAvail = Number((avail - take).toFixed(3))
      remaining = Number((remaining - take).toFixed(3))

      lot.available_quantity = newAvail
      lotsToUpdate.push(lot)

      allocations.push({
        lot_id: lot.id,
        lot_number: lot.lot_number,
        quantity: take,
        expiration_date: lot.expiration_date,
      })

      movementsToCreate.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        product_unit: p.unit,
        lot_id: lot.id,
        lot_number: lot.lot_number,
        movement_type: 'SALIDA_VENTA',
        quantity: -take,
        previous_stock: avail,
        new_stock: newAvail,
        reason: `Venta en POS`,
        user_name: currentUser?.full_name || 'Operador POS',
        created_at: nowISO,
      })
    }

    const lineSubtotal = Math.round(qtyNeeded * Number(p.sale_price))
    total += lineSubtotal

    saleItems.push({
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      unit: p.unit,
      quantity: qtyNeeded,
      unit_price: Number(p.sale_price),
      subtotal: lineSubtotal,
      allocations,
    })
  }

  const paymentMethod = payload.payment_method || 'efectivo'
  const methodLabels = {
    efectivo: 'Efectivo',
    nequi: 'Nequi (Transferencia)',
    bancolombia: 'Bancolombia (Transferencia)',
    daviplata: 'Daviplata',
  }

  const amountReceived =
    paymentMethod === 'efectivo' && payload.amount_received
      ? Number(payload.amount_received)
      : total

  if (paymentMethod === 'efectivo' && amountReceived < total) {
    throw new Error('El efectivo recibido es menor al total a cobrar.')
  }

  const folioNumber = existingSales.length + 1
  const folio = `POS-${String(folioNumber).padStart(6, '0')}`
  const storeProfile = getStoredProfileSync()

  const saleRecord = {
    id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    folio,
    client_operation_id: payload.client_operation_id || folio,
    created_at: nowISO,
    date_iso: today,
    seller_id: currentUser?.id || 'usr-tendero-1',
    seller_name: currentUser?.full_name || 'Tendero',
    seller_username: currentUser?.username || 'tendero',
    payment_method: paymentMethod,
    payment_method_name: methodLabels[paymentMethod] || paymentMethod,
    subtotal: total,
    total,
    amount_received: amountReceived,
    change_amount: Math.max(0, amountReceived - total),
    items: saleItems,
    store_snapshot: storeProfile || null,
    transfer_verification: payload.transfer_verification || null,
  }

  for (const m of movementsToCreate) {
    m.reason = `Venta ${folio} (${saleRecord.payment_method_name})`
  }

  const db = await openLocalDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['lots', 'sales', 'movements'], 'readwrite')
    const lotStore = tx.objectStore('lots')
    const saleStore = tx.objectStore('sales')
    const movStore = tx.objectStore('movements')

    for (const l of lotsToUpdate) lotStore.put(l)
    for (const m of movementsToCreate) movStore.put(m)
    saleStore.put(saleRecord)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  return saleRecord
}

/**
 * Calcula las Métricas Rápidas para el panel del Dueño:
 * 1. Ventas del día (COP + nro transacciones + transferencias verificadas)
 * 2. Producto más vendido (nombre, SKU y unidades vendidas)
 * 3. Alerta de bajo stock (cantidad de productos con stock <= min_stock)
 */
export function computeOwnerQuickMetrics(products = [], sales = []) {
  const today = getTodayISO()

  const todaySales = sales.filter((s) => {
    const sDate = s.date_iso || String(s.created_at || '').slice(0, 10)
    return sDate === today
  })

  const todayTotalCOP = todaySales.reduce((acc, s) => acc + Number(s.total || 0), 0)
  const verifiedTransfersCount = todaySales.filter((s) => Boolean(s.transfer_verification?.photo_data_url)).length

  // Calcular Producto Más Vendido en todas las ventas (o ventas del día)
  const tally = new Map()
  for (const s of sales) {
    for (const item of s.items || []) {
      const prev = tally.get(item.product_id) || {
        product_id: item.product_id,
        name: item.product_name,
        sku: item.product_sku,
        quantity: 0,
        revenue: 0,
      }
      prev.quantity = Number((prev.quantity + Number(item.quantity || 0)).toFixed(3))
      prev.revenue += Number(item.subtotal || 0)
      tally.set(item.product_id, prev)
    }
  }

  let topProduct = null
  for (const entry of tally.values()) {
    if (!topProduct || entry.quantity > topProduct.quantity) {
      topProduct = entry
    }
  }

  const activeProducts = products.filter((p) => p.is_active)
  const lowStockProducts = activeProducts.filter(
    (p) => Number(p.available_stock || 0) <= Number(p.min_stock ?? 5)
  )
  const outOfStockProducts = activeProducts.filter((p) => Number(p.available_stock || 0) <= 0)

  return {
    today_date: today,
    today_sales_total: todayTotalCOP,
    today_sales_count: todaySales.length,
    verified_transfers_count: verifiedTransfersCount,
    top_product: topProduct || {
      name: 'Sin ventas registradas hoy',
      sku: '—',
      quantity: 0,
      revenue: 0,
    },
    low_stock_count: lowStockProducts.length,
    out_of_stock_count: outOfStockProducts.length,
    low_stock_items: lowStockProducts.slice(0, 8),
  }
}

// Operaciones CRUD adicionales para Dueño en IndexedDB
export async function createOrUpdateCategoryLocal(payload) {
  const id = String(Date.now())
  const cat = {
    id,
    name: String(payload.name || '').trim(),
    description: String(payload.description || '').trim(),
    created_at: new Date().toISOString(),
  }
  await putInStore('categories', cat)
  return cat
}

export async function createProductLocal(payload, currentUser) {
  const nowISO = new Date().toISOString()
  const id = `prod-custom-${Date.now()}`
  const sku = String(payload.sku || '').trim().toUpperCase()
  const name = String(payload.name || '').trim()

  const newProd = {
    id,
    sku,
    barcode: payload.barcode ? String(payload.barcode).trim() : null,
    name,
    category_id: String(payload.category_id || '1'),
    unit: payload.unit || 'und',
    sale_price: Number(payload.sale_price),
    unit_cost: Number(payload.initial_lot?.unit_cost || Math.round(Number(payload.sale_price) * 0.7)),
    min_stock: Number(payload.min_stock ?? 5),
    is_active: true,
    image_url:
      payload.image_url ||
      `https://picsum.photos/seed/kairo-${encodeURIComponent(sku)}/240/240`,
    created_at: nowISO,
    updated_at: nowISO,
  }

  await putInStore('products', newProd)

  if (payload.initial_lot && Number(payload.initial_lot.quantity) > 0) {
    await createLotLocal(
      {
        product_id: id,
        lot_number: payload.initial_lot.lot_number || `L-${sku}-01`,
        quantity: Number(payload.initial_lot.quantity),
        unit_cost: Number(payload.initial_lot.unit_cost || 0),
        entry_date: payload.initial_lot.entry_date || getTodayISO(),
        expiration_date: payload.initial_lot.expiration_date || null,
        notes: 'Lote inicial de creación',
      },
      currentUser
    )
  }

  return newProd
}

export async function updateProductLocal(productId, payload) {
  const products = await getAllFromStore('products')
  const target = products.find((p) => p.id === productId)
  if (!target) throw new Error('Producto no encontrado.')

  const updated = {
    ...target,
    ...payload,
    updated_at: new Date().toISOString(),
  }
  await putInStore('products', updated)
  return updated
}

export async function createLotLocal(payload, currentUser) {
  const products = await getAllFromStore('products')
  const prod = products.find((p) => p.id === payload.product_id)
  if (!prod) throw new Error('Producto no encontrado para asignar lote.')

  const nowISO = new Date().toISOString()
  const qty = Number(payload.quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('La cantidad del lote debe ser mayor a cero.')
  }

  const lot = {
    id: `lot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: prod.id,
    lot_number: String(payload.lot_number || `L-${Date.now()}`).trim(),
    initial_quantity: qty,
    available_quantity: qty,
    unit_cost: Number(payload.unit_cost || prod.unit_cost || 0),
    entry_date: payload.entry_date || getTodayISO(),
    expiration_date: payload.expiration_date || null,
    notes: payload.notes || '',
    created_at: nowISO,
  }

  const movement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: prod.id,
    product_name: prod.name,
    product_sku: prod.sku,
    product_unit: prod.unit,
    lot_id: lot.id,
    lot_number: lot.lot_number,
    movement_type: 'ENTRADA',
    quantity: qty,
    previous_stock: 0,
    new_stock: qty,
    reason: payload.notes || 'Ingreso de nuevo lote de inventario',
    user_name: currentUser?.full_name || 'Dueño',
    created_at: nowISO,
  }

  await putInStore('lots', lot)
  await putInStore('movements', movement)
  return lot
}

export async function adjustLotLocal(lotId, payload, currentUser) {
  const [lots, products] = await Promise.all([
    getAllFromStore('lots'),
    getAllFromStore('products'),
  ])
  const lot = lots.find((l) => l.id === lotId)
  if (!lot) throw new Error('Lote no encontrado.')
  const prod = products.find((p) => p.id === lot.product_id) || {}

  const prev = Number(lot.available_quantity || 0)
  const q = Number(payload.quantity || 0)
  let next = prev

  if (payload.operation === 'ENTRADA_AJUSTE') {
    next = Number((prev + q).toFixed(3))
  } else if (payload.operation === 'SALIDA_MERMA') {
    if (q > prev) throw new Error('La salida supera el saldo disponible del lote.')
    next = Number((prev - q).toFixed(3))
  } else if (payload.operation === 'AJUSTE_DIRECTO') {
    next = Number(q.toFixed(3))
  }

  lot.available_quantity = next
  if (payload.unit_cost !== undefined) lot.unit_cost = Number(payload.unit_cost)
  if (payload.expiration_date !== undefined) lot.expiration_date = payload.expiration_date || null

  const delta = Number((next - prev).toFixed(3))
  const movement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: lot.product_id,
    product_name: prod.name || 'Producto',
    product_sku: prod.sku || '—',
    product_unit: prod.unit || 'und',
    lot_id: lot.id,
    lot_number: lot.lot_number,
    movement_type: payload.operation || 'AJUSTE',
    quantity: delta,
    previous_stock: prev,
    new_stock: next,
    reason: payload.reason || 'Ajuste manual de lote',
    user_name: currentUser?.full_name || 'Dueño',
    created_at: new Date().toISOString(),
  }

  await putInStore('lots', lot)
  await putInStore('movements', movement)
  return lot
}

export async function getFilteredSalesLocal(filters = {}) {
  const sales = await getAllFromStore('sales')
  const sorted = sales.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  const filtered = sorted.filter((s) => {
    const sDate = s.date_iso || String(s.created_at).slice(0, 10)
    if (filters.date_from && sDate < filters.date_from) return false
    if (filters.date_to && sDate > filters.date_to) return false
    if (filters.user_id && s.seller_id !== filters.user_id) return false
    if (filters.payment_method && s.payment_method !== filters.payment_method) return false
    if (filters.product_id) {
      const hasProd = (s.items || []).some((i) => i.product_id === filters.product_id)
      if (!hasProd) return false
    }
    return true
  })

  const byMethod = { efectivo: 0, nequi: 0, bancolombia: 0, daviplata: 0 }
  let grandTotal = 0
  for (const s of filtered) {
    grandTotal += Number(s.total || 0)
    byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total || 0)
  }

  return {
    sales: filtered,
    summary: {
      count: filtered.length,
      grand_total: grandTotal,
      by_payment_method: byMethod,
    },
  }
}

export async function getUsersLocal() {
  const [users, sales] = await Promise.all([
    getAllFromStore('users'),
    getAllFromStore('sales'),
  ])
  return users.map((u) => ({
    ...u,
    total_sales_count: sales.filter((s) => s.seller_id === u.id).length,
  }))
}

export async function createUserLocal(payload) {
  const users = await getAllFromStore('users')
  const username = String(payload.username || '').trim().toLowerCase()
  if (users.some((u) => u.username === username)) {
    throw new Error(`El usuario @${username} ya existe.`)
  }
  const role = payload.role === 'dueno' ? 'dueno' : 'tendero'
  const newUser = {
    id: `usr-${Date.now()}`,
    username,
    full_name: String(payload.full_name || '').trim(),
    document_id: String(payload.document_id || '').trim(),
    role,
    role_name: role === 'dueno' ? 'Dueño' : 'Tendero',
    password: String(payload.password || 'Tendero2026!'),
    is_active: true,
    created_at: new Date().toISOString(),
  }
  await putInStore('users', newUser)
  return newUser
}

export async function updateUserLocal(userId, payload) {
  const users = await getAllFromStore('users')
  const target = users.find((u) => u.id === userId)
  if (!target) throw new Error('Usuario no encontrado.')

  if (payload.full_name) target.full_name = String(payload.full_name).trim()
  if (payload.role) {
    target.role = payload.role
    target.role_name = payload.role === 'dueno' ? 'Dueño' : 'Tendero'
  }
  if (payload.is_active !== undefined) target.is_active = Boolean(payload.is_active)
  if (payload.password) target.password = String(payload.password)

  await putInStore('users', target)
  return target
}

export async function authenticateLocalUser(username, password) {
  const users = await getAllFromStore('users')
  const cleanUser = String(username || '').trim().toLowerCase()
  const found = users.find((u) => u.username.toLowerCase() === cleanUser)

  if (!found) {
    throw new Error('Usuario o contraseña incorrectos.')
  }
  if (!found.is_active) {
    throw new Error('Esta cuenta de usuario se encuentra desactivada.')
  }
  if (found.password !== String(password)) {
    throw new Error('Usuario o contraseña incorrectos.')
  }

  const profile = getStoredProfileSync()
  const sessionUser = {
    id: found.id,
    username: found.username,
    full_name: found.full_name,
    document_id: found.document_id || '',
    role: found.role,
    role_name: found.role_name,
    store: profile,
  }
  setActiveSessionSync(sessionUser)
  return sessionUser
}
