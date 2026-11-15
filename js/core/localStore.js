/**
 * js/core/localStore.js — Motor de Persistencia Local (IndexedDB + LocalStorage)
 * - Onboarding de Tienda EN BLANCO (Cero productos falsos obligatorios al registrarse)
 * - Estado del Tutorial Interactivo Paso a Paso (1. Crear producto -> 2. Venta de prueba -> 3. Ver descuento de stock)
 * - Panel de Ajustes con Toggles persistentes
 * - Muro de Reseñas Privado (almacenado en IndexedDB, exclusivo para usuarios logueados en /app)
 * - Lotes FEFO/FIFO, Kardex y Ventas con evidencia en <canvas>
 */

import { SEED_CATEGORIES, SEED_PRODUCTS } from '../data/db.js'

const IDB_NAME = 'kairo_pos_idb_v4'
const IDB_VERSION = 1

export const LS_KEYS = {
  STORE_PROFILE: 'tiendapp_store_profile_v4',
  ACTIVE_SESSION: 'tiendapp_active_session_v4',
  UI_SETTINGS: 'tiendapp_ui_settings_v4',
  TOUR_STATE: 'tiendapp_tour_state_v4',
}

const DEFAULT_UI_SETTINGS = {
  scannerSound: true,
  showThumbnails: true,
  requireTransferPhoto: false,
  compactDensity: false,
  inlineMobileScanner: false,
}

let dbPromise = null

export function getTodayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Genera una miniatura SVG estética en Data URI como fallback infalible (onerror)
 * para que jamás se muestre un ícono de imagen rota.
 */
export function buildAestheticFallbackSVG(name = 'Producto', sku = 'POS') {
  const initials = String(name || 'PR')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || 'PR'
  const cleanSku = String(sku || 'ITEM').slice(0, 10).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#141b26"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="14" fill="url(#g)"/>
    <circle cx="80" cy="66" r="28" fill="rgba(59,130,246,0.14)" stroke="rgba(59,130,246,0.4)" stroke-width="1.5"/>
    <text x="80" y="74" text-anchor="middle" fill="#60a5fa" font-family="system-ui,sans-serif" font-size="22" font-weight="700">${initials.replace(/[<>&"']/g, '')}</text>
    <text x="80" y="124" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="600">${cleanSku.replace(/[<>&"']/g, '')}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

if (typeof window !== 'undefined') {
  window.handleProductImageError = function (imgEl, name, sku) {
    if (!imgEl || imgEl.dataset.fallbackApplied === '1') return
    imgEl.dataset.fallbackApplied = '1'
    imgEl.src = buildAestheticFallbackSVG(name || imgEl.alt || 'Producto', sku || 'ITEM')
  }
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
        'reviews',
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

async function clearObjectStore(storeName) {
  const db = await openLocalDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

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
 * Gestión de Ajustes de Interfaz (Toggles)
 */
export function getUISettingsSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.UI_SETTINGS)
    return raw ? { ...DEFAULT_UI_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_UI_SETTINGS }
  } catch {
    return { ...DEFAULT_UI_SETTINGS }
  }
}

export function saveUISettingsSync(patch) {
  const next = { ...getUISettingsSync(), ...patch }
  localStorage.setItem(LS_KEYS.UI_SETTINGS, JSON.stringify(next))
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(
      'data-density',
      next.compactDensity ? 'compact' : 'comfortable'
    )
  }
  return next
}

/**
 * Gestión del Tutorial Interactivo Paso a Paso (Tour)
 * Pasos:
 * 1 -> Crear su primer producto
 * 2 -> Hacer una venta de prueba en el POS
 * 3 -> Ver cómo se descontó el stock en Inventario/Kardex
 * 4 -> Completado
 */
export function getTourStateSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.TOUR_STATE)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {
    active: true,
    step: 1,
    completed: false,
  }
}

export function saveTourStateSync(patch) {
  const current = getTourStateSync()
  const next = { ...current, ...patch }
  localStorage.setItem(LS_KEYS.TOUR_STATE, JSON.stringify(next))
  return next
}

export function syncTourProgress(productsCount, salesCount) {
  const cur = getTourStateSync()
  if (cur.completed || !cur.active) return cur

  let nextStep = cur.step
  if (productsCount === 0) {
    nextStep = 1
  } else if (productsCount >= 1 && salesCount === 0 && cur.step < 2) {
    nextStep = 2
  } else if (productsCount >= 1 && salesCount >= 1 && cur.step < 3) {
    nextStep = 3
  }

  if (nextStep !== cur.step) {
    return saveTourStateSync({ step: nextStep })
  }
  return cur
}

/**
 * Asegura únicamente las categorías base (sin agregar productos falsos automáticamente)
 */
export async function ensureBaseCategories() {
  const existingCats = await getAllFromStore('categories')
  if (existingCats.length > 0) return existingCats

  const nowISO = new Date().toISOString()
  for (const cat of SEED_CATEGORIES) {
    await putInStore('categories', {
      id: String(cat.id),
      name: cat.name,
      description: cat.description || '',
      created_at: nowISO,
    })
  }
  return getAllFromStore('categories')
}

/**
 * Opción manual (solo bajo petición explícita en Ajustes) para cargar el catálogo de 400 productos
 */
export async function loadOptional400Catalog() {
  await ensureBaseCategories()
  const db = await openLocalDB()
  const nowISO = new Date().toISOString()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['products', 'lots', 'movements'], 'readwrite')
    const prodStore = tx.objectStore('products')
    const lotStore = tx.objectStore('lots')
    const movStore = tx.objectStore('movements')

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
        notes: 'Catálogo semilla opcional',
        created_at: nowISO,
      })
    }

    movStore.put({
      id: `mov-seed-${Date.now()}`,
      product_id: SEED_PRODUCTS[0].id,
      product_name: 'Importación Manual Catálogo (400 productos)',
      product_sku: 'SEED-400',
      product_unit: 'und',
      lot_id: `lot-${SEED_PRODUCTS[0].id}`,
      lot_number: 'L-2026-IMPORT',
      movement_type: 'ENTRADA',
      quantity: 400,
      previous_stock: 0,
      new_stock: 400,
      reason: 'Importación opcional desde Ajustes',
      user_name: 'Dueño',
      created_at: nowISO,
    })

    tx.oncomplete = () => resolve(SEED_PRODUCTS.length)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Registra la tienda en el Onboarding:
 * REQUISITO ESTRICTO: Cuando un dueño se registra, su tienda debe estar EN BLANCO.
 * No se agregan los 400 productos automáticamente; se inicia el Tutorial Paso a Paso en el Paso 1.
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

  // Limpiar productos, lotes y ventas previos para garantizar una tienda 100% en blanco al registrarse
  await Promise.all([
    clearObjectStore('products'),
    clearObjectStore('lots'),
    clearObjectStore('sales'),
    clearObjectStore('movements'),
  ])

  await ensureBaseCategories()

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

  // Sembrar una reseña inicial de bienvenida en el Muro de Reseñas Privado
  const existingReviews = await getAllFromStore('reviews')
  if (existingReviews.length === 0) {
    await putInStore('reviews', {
      id: 'rev-welcome-1',
      author_name: owner_name,
      author_role: 'Dueño',
      store_name,
      rating: 5,
      category: 'Diseño y Usabilidad',
      comment: `Tienda "${store_name}" configurada exitosamente en TiendApp. Lista para operar en PC y móvil.`,
      created_at: nowISO,
    })
  }

  localStorage.setItem(LS_KEYS.STORE_PROFILE, JSON.stringify(profile))
  saveTourStateSync({ active: true, step: 1, completed: false })

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

export async function getCatalogWithStock() {
  await ensureBaseCategories()
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
        previous_stock: avail,
        new_stock: newAvail,
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

  // Actualizar progreso del tutorial (Paso 2 -> Paso 3 al registrar primera venta)
  syncTourProgress(products.length, existingSales.length + 1)

  return saleRecord
}

export function computeOwnerQuickMetrics(products = [], sales = []) {
  const today = getTodayISO()

  const todaySales = sales.filter((s) => {
    const sDate = s.date_iso || String(s.created_at || '').slice(0, 10)
    return sDate === today
  })

  const todayTotalCOP = todaySales.reduce((acc, s) => acc + Number(s.total || 0), 0)
  const verifiedTransfersCount = todaySales.filter((s) =>
    Boolean(s.transfer_verification?.photo_data_url)
  ).length

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
  const id = `prod-${Date.now()}`
  const sku = String(payload.sku || `SKU-${Date.now().toString().slice(-4)}`)
    .trim()
    .toUpperCase()
  const name = String(payload.name || '').trim()

  const newProd = {
    id,
    sku,
    barcode: payload.barcode ? String(payload.barcode).trim() : `770${Date.now().toString().slice(-10)}`,
    name,
    category_id: String(payload.category_id || '1'),
    unit: payload.unit || 'und',
    sale_price: Number(payload.sale_price),
    unit_cost: Number(payload.initial_lot?.unit_cost || Math.round(Number(payload.sale_price) * 0.7)),
    min_stock: Number(payload.min_stock ?? 5),
    is_active: true,
    image_url:
      payload.image_url ||
      `https://picsum.photos/seed/tiendapp-${encodeURIComponent(sku)}/240/240`,
    created_at: nowISO,
    updated_at: nowISO,
  }

  await putInStore('products', newProd)

  const initQty = Number(payload.initial_lot?.quantity ?? 10)
  if (initQty > 0) {
    await createLotLocal(
      {
        product_id: id,
        lot_number: payload.initial_lot?.lot_number || `L-${sku}-01`,
        quantity: initQty,
        unit_cost: Number(payload.initial_lot?.unit_cost || newProd.unit_cost),
        entry_date: payload.initial_lot?.entry_date || getTodayISO(),
        expiration_date: payload.initial_lot?.expiration_date || null,
        notes: 'Lote inicial de apertura',
      },
      currentUser
    )
  }

  const allProds = await getAllFromStore('products')
  const allSales = await getAllFromStore('sales')
  syncTourProgress(allProds.length, allSales.length)

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

/**
 * Sistema de Reseñas Privado ("Muro de Reseñas" exclusivo para usuarios logueados en /app)
 */
export async function getPrivateReviewsLocal() {
  const reviews = await getAllFromStore('reviews')
  return reviews.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

export async function createPrivateReviewLocal(payload, currentUser) {
  const comment = String(payload.comment || '').trim()
  const rating = Math.min(5, Math.max(1, Number(payload.rating || 5)))
  const category = String(payload.category || 'General').trim()

  if (comment.length < 4) {
    throw new Error('Escribe una reseña de al menos 4 caracteres.')
  }

  const storeProfile = getStoredProfileSync()
  const review = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author_name: currentUser?.full_name || 'Usuario Autenticado',
    author_role: currentUser?.role_name || 'Dueño',
    store_name: storeProfile?.store_name || 'Mi Tienda',
    rating,
    category,
    comment,
    created_at: new Date().toISOString(),
  }

  await putInStore('reviews', review)
  return review
}
