import {
  STORES,
  generateId,
  getAllFromStore,
  getById,
  putInStore,
  putManyInStores,
  deleteFromStore,
} from '../core/db.js'
import { assertOwnerPermission } from '../core/permissions.js'
import { DEFAULT_TIENDA_ID } from '../core/session.js'
import { roundQty } from '../utils/quantities.js'
import { roundMoney } from '../utils/money.js'
import { getTodayISO, isLotExpired, validateLotPayload } from '../utils/validation.js'
import { createMovementRecord } from './inventory.js'

/**
 * Servicio de Gestión de Lotes (Método FIFO con desempate FEFO y bloqueo de vencidos).
 *
 * Entidad Lote:
 * - id
 * - tienda_id
 * - producto_id
 * - codigo_lote
 * - fecha_entrada (YYYY-MM-DD)
 * - fecha_vencimiento (YYYY-MM-DD | null)
 * - costo_unitario
 * - cantidad_inicial
 * - cantidad_disponible
 * - created_at
 */

export function sortLotsFIFO(lots = []) {
  return [...lots].sort((a, b) => {
    // 1. Primero en entrar, primero en salir (fecha_entrada ascendente)
    const entryA = String(a.fecha_entrada || '9999-12-31')
    const entryB = String(b.fecha_entrada || '9999-12-31')
    if (entryA !== entryB) {
      return entryA.localeCompare(entryB)
    }

    // 2. Desempate por vencimiento más próximo (FEFO)
    const expA = a.fecha_vencimiento ? String(a.fecha_vencimiento) : '9999-12-31'
    const expB = b.fecha_vencimiento ? String(b.fecha_vencimiento) : '9999-12-31'
    if (expA !== expB) {
      return expA.localeCompare(expB)
    }

    // 3. Orden de creación
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })
}

export function getSellableLotsFIFO(lots = [], referenceDateISO = getTodayISO()) {
  const valid = lots.filter(
    (lote) =>
      roundQty(lote.cantidad_disponible) > 0 &&
      !isLotExpired(lote.fecha_vencimiento, referenceDateISO)
  )
  return sortLotsFIFO(valid)
}

export function summarizeProductLots(lots = [], referenceDateISO = getTodayISO()) {
  const ordered = sortLotsFIFO(lots)
  let disponibleVenta = 0
  let stockVencido = 0
  let lotesActivos = 0
  let lotesVencidos = 0
  let proximoLoteFIFO = null
  let costoPonderadoAcum = 0

  for (const lote of ordered) {
    const qty = roundQty(lote.cantidad_disponible)
    if (qty <= 0) continue
    const expired = isLotExpired(lote.fecha_vencimiento, referenceDateISO)
    if (expired) {
      stockVencido = roundQty(stockVencido + qty)
      lotesVencidos += 1
    } else {
      disponibleVenta = roundQty(disponibleVenta + qty)
      lotesActivos += 1
      costoPonderadoAcum += qty * roundMoney(lote.costo_unitario)
      if (!proximoLoteFIFO) {
        proximoLoteFIFO = lote
      }
    }
  }

  const costoReferencia = proximoLoteFIFO
    ? roundMoney(proximoLoteFIFO.costo_unitario)
    : disponibleVenta > 0
    ? roundMoney(costoPonderadoAcum / disponibleVenta)
    : ordered.length > 0
    ? roundMoney(ordered[ordered.length - 1].costo_unitario)
    : 0

  return {
    cantidad_disponible: disponibleVenta,
    cantidad_vencida: stockVencido,
    cantidad_total_fisica: roundQty(disponibleVenta + stockVencido),
    lotes_activos: lotesActivos,
    lotes_vencidos: lotesVencidos,
    proximo_lote: proximoLoteFIFO,
    precio_costo_referencia: costoReferencia,
    lotes_ordenados: ordered,
  }
}

/**
 * Calcula la asignación exacta por lotes según FIFO (+ desempate FEFO),
 * excluyendo lotes vencidos. Lanza error si las existencias vendibles no alcanzan.
 */
export function allocateLotsForSale(
  productLots = [],
  requestedQuantity,
  referenceDateISO = getTodayISO()
) {
  const needed = roundQty(requestedQuantity)
  if (needed <= 0) {
    throw new Error('La cantidad a descontar debe ser mayor a 0.')
  }

  const sellable = getSellableLotsFIFO(productLots, referenceDateISO)
  const totalAvailable = sellable.reduce(
    (sum, l) => roundQty(sum + roundQty(l.cantidad_disponible)),
    0
  )

  if (totalAvailable < needed) {
    throw new Error(
      `Stock vendible insuficiente (solicitado: ${needed}, disponible en lotes vigentes: ${totalAvailable}).`
    )
  }

  let remaining = needed
  const allocations = []
  const updatedLots = []

  for (const lote of sellable) {
    if (remaining <= 0) break
    const availableInLot = roundQty(lote.cantidad_disponible)
    if (availableInLot <= 0) continue

    const take = roundQty(Math.min(availableInLot, remaining))
    const newAvailable = roundQty(availableInLot - take)
    remaining = roundQty(remaining - take)

    const updatedLot = {
      ...lote,
      cantidad_disponible: newAvailable,
      updated_at: new Date().toISOString(),
    }

    updatedLots.push(updatedLot)
    allocations.push({
      lote_id: lote.id,
      codigo_lote: lote.codigo_lote,
      fecha_entrada: lote.fecha_entrada,
      fecha_vencimiento: lote.fecha_vencimiento || null,
      cantidad_descontada: take,
      costo_unitario: roundMoney(lote.costo_unitario),
      stock_lote_anterior: availableInLot,
      stock_lote_nuevo: newAvailable,
    })
  }

  return {
    allocations,
    updatedLots,
  }
}

export async function listLots(tiendaId = DEFAULT_TIENDA_ID, productoId = null) {
  const all = await getAllFromStore(STORES.LOTES, tiendaId)
  const filtered = productoId ? all.filter((l) => l.producto_id === productoId) : all
  return sortLotsFIFO(filtered)
}

export async function createLot(payload, user) {
  assertOwnerPermission(user, 'registrar nuevos lotes')
  const validation = validateLotPayload(payload)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }
  if (!payload?.producto_id) {
    throw new Error('Debe indicar el producto al que pertenece el lote.')
  }

  const tiendaId = user?.tienda_id || DEFAULT_TIENDA_ID
  const now = new Date().toISOString()
  const qty = validation.cleaned.cantidad_disponible

  const lote = {
    id: payload.id || generateId('lot'),
    tienda_id: tiendaId,
    producto_id: payload.producto_id,
    codigo_lote: validation.cleaned.codigo_lote,
    fecha_entrada: validation.cleaned.fecha_entrada,
    fecha_vencimiento: validation.cleaned.fecha_vencimiento,
    costo_unitario: validation.cleaned.costo_unitario,
    cantidad_inicial: roundQty(payload.cantidad_inicial ?? qty),
    cantidad_disponible: qty,
    notas: String(payload.notas || '').trim() || null,
    created_at: now,
    updated_at: now,
  }

  const mov = createMovementRecord({
    tienda_id: tiendaId,
    producto_id: lote.producto_id,
    lote_id: lote.id,
    codigo_lote: lote.codigo_lote,
    tipo: 'entrada_lote',
    cantidad: qty,
    stock_anterior: 0,
    stock_nuevo: qty,
    costo_unitario: lote.costo_unitario,
    motivo: payload.motivo || `Entrada de lote ${lote.codigo_lote}`,
    usuario: user,
  })

  await putManyInStores([
    { store: STORES.LOTES, record: lote },
    { store: STORES.MOVIMIENTOS, record: mov },
  ])

  return lote
}

export async function updateLot(loteId, payload, user) {
  assertOwnerPermission(user, 'modificar lotes e inventario')
  const existing = await getById(STORES.LOTES, loteId)
  if (!existing) {
    throw new Error('No se encontró el lote indicado.')
  }

  const merged = {
    ...existing,
    ...payload,
    cantidad_disponible:
      payload.cantidad_disponible !== undefined
        ? payload.cantidad_disponible
        : existing.cantidad_disponible,
  }

  const validation = validateLotPayload(merged)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const prevQty = roundQty(existing.cantidad_disponible)
  const nextQty = validation.cleaned.cantidad_disponible
  const delta = roundQty(nextQty - prevQty)

  const updated = {
    ...existing,
    codigo_lote: validation.cleaned.codigo_lote,
    fecha_entrada: validation.cleaned.fecha_entrada,
    fecha_vencimiento: validation.cleaned.fecha_vencimiento,
    costo_unitario: validation.cleaned.costo_unitario,
    cantidad_disponible: nextQty,
    notas: payload.notas !== undefined ? String(payload.notas || '').trim() : existing.notas,
    updated_at: new Date().toISOString(),
  }

  const ops = [{ store: STORES.LOTES, record: updated }]

  if (delta !== 0) {
    const mov = createMovementRecord({
      tienda_id: existing.tienda_id,
      producto_id: existing.producto_id,
      lote_id: existing.id,
      codigo_lote: updated.codigo_lote,
      tipo: 'ajuste_lote',
      cantidad: delta,
      stock_anterior: prevQty,
      stock_nuevo: nextQty,
      costo_unitario: updated.costo_unitario,
      motivo: payload.motivo || `Ajuste manual en lote ${updated.codigo_lote}`,
      usuario: user,
    })
    ops.push({ store: STORES.MOVIMIENTOS, record: mov })
  }

  await putManyInStores(ops)
  return updated
}

export async function deleteLot(loteId, user) {
  assertOwnerPermission(user, 'eliminar lotes')
  const existing = await getById(STORES.LOTES, loteId)
  if (!existing) return false

  const prevQty = roundQty(existing.cantidad_disponible)
  await deleteFromStore(STORES.LOTES, loteId)

  if (prevQty > 0) {
    const mov = createMovementRecord({
      tienda_id: existing.tienda_id,
      producto_id: existing.producto_id,
      lote_id: existing.id,
      codigo_lote: existing.codigo_lote,
      tipo: 'baja_lote',
      cantidad: -prevQty,
      stock_anterior: prevQty,
      stock_nuevo: 0,
      costo_unitario: existing.costo_unitario,
      motivo: `Eliminación manual de lote ${existing.codigo_lote}`,
      usuario: user,
    })
    await putInStore(STORES.MOVIMIENTOS, mov)
  }
  return true
}
