import {
  STORES,
  generateId,
  getAllFromStore,
  getById,
  putManyInStores,
} from '../core/db.js'
import { canSell, assertOwnerPermission } from '../core/permissions.js'
import { DEFAULT_TIENDA_ID } from '../core/session.js'
import { roundQty } from '../utils/quantities.js'
import { roundMoney, calculateChange } from '../utils/money.js'
import { getTodayISO } from '../utils/validation.js'
import { allocateLotsForSale, listLots } from './lots.js'
import { createMovementRecord } from './inventory.js'

/**
 * Servicio de Ventas y Asignación por Lotes (FIFO + FEFO).
 * Rescata la estructura de useVentas.js y app/models.py (Venta, DetalleVenta),
 * incorporando AsignacionVentaLote para descontar unidades provenientes de uno o
 * varios lotes y devolverlas exactamente a sus lotes originales en caso de anulación.
 */

export async function listSales(tiendaId = DEFAULT_TIENDA_ID) {
  const all = await getAllFromStore(STORES.VENTAS, tiendaId)
  return all.sort((a, b) =>
    String(b.fecha_venta || '').localeCompare(String(a.fecha_venta || ''))
  )
}

export async function registerSale(cartItems = [], options = {}, user, referenceDateISO = getTodayISO()) {
  if (!canSell(user)) {
    throw new Error('No tiene permisos para registrar ventas.')
  }
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('El carrito está vacío.')
  }

  const tiendaId = user?.tienda_id || DEFAULT_TIENDA_ID
  const [allProducts, allLots] = await Promise.all([
    getAllFromStore(STORES.PRODUCTOS, tiendaId),
    listLots(tiendaId),
  ])

  const productMap = new Map(allProducts.map((p) => [p.id, p]))
  const lotsByProduct = new Map()
  for (const lote of allLots) {
    if (!lotsByProduct.has(lote.producto_id)) {
      lotsByProduct.set(lote.producto_id, [])
    }
    lotsByProduct.get(lote.producto_id).push(lote)
  }

  const saleId = options.client_operation_id || generateId('vta')
  const nowISO = new Date().toISOString()
  const detalles = []
  const storeOps = []
  let totalVenta = 0

  for (const item of cartItems) {
    const productoId = item.producto_id || item.id
    const cantidad = roundQty(item.cantidad)
    if (!productoId || cantidad <= 0) {
      throw new Error('Cantidad inválida en el detalle de venta.')
    }

    const prod = productMap.get(productoId)
    if (!prod || prod.is_active === false) {
      throw new Error(`El producto "${item.nombre || productoId}" no existe o está inactivo.`)
    }

    const productLots = lotsByProduct.get(productoId) || []
    let allocationResult
    try {
      allocationResult = allocateLotsForSale(productLots, cantidad, referenceDateISO)
    } catch (err) {
      throw new Error(` Stock insuficiente para "${prod.nombre}": ${err.message}`)
    }

    // Actualizar mapa en memoria por si el carrito repite referencia al mismo producto
    const updatedLotMap = new Map(allocationResult.updatedLots.map((u) => [u.id, u]))
    lotsByProduct.set(
      productoId,
      productLots.map((l) => updatedLotMap.get(l.id) || l)
    )

    const precioUnitario = roundMoney(prod.precio_venta)
    const subtotal = roundMoney(precioUnitario * cantidad)
    totalVenta = roundMoney(totalVenta + subtotal)

    const costoTotalDetalle = allocationResult.allocations.reduce(
      (acc, a) => acc + roundMoney(a.costo_unitario) * roundQty(a.cantidad_descontada),
      0
    )
    const costoUnitarioSnapshot =
      cantidad > 0 ? roundMoney(costoTotalDetalle / cantidad) : 0

    const detalleId = generateId('det')
    const asignaciones = allocationResult.allocations.map((alloc) => ({
      id: generateId('asig'),
      detalle_venta_id: detalleId,
      lote_id: alloc.lote_id,
      codigo_lote: alloc.codigo_lote,
      fecha_entrada: alloc.fecha_entrada,
      fecha_vencimiento: alloc.fecha_vencimiento,
      cantidad_descontada: alloc.cantidad_descontada,
      costo_unitario: alloc.costo_unitario,
    }))

    detalles.push({
      id: detalleId,
      venta_id: saleId,
      producto_id: prod.id,
      producto_nombre: prod.nombre,
      unidad_medida: prod.unidad_medida || 'unidad',
      cantidad,
      precio_unitario: precioUnitario,
      costo_unitario_snapshot: costoUnitarioSnapshot,
      subtotal,
      asignaciones_lote: asignaciones,
    })

    for (const updatedLot of allocationResult.updatedLots) {
      storeOps.push({ store: STORES.LOTES, record: updatedLot })
    }

    for (const alloc of allocationResult.allocations) {
      const mov = createMovementRecord({
        tienda_id: tiendaId,
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        lote_id: alloc.lote_id,
        codigo_lote: alloc.codigo_lote,
        tipo: 'venta_fifo',
        cantidad: -alloc.cantidad_descontada,
        stock_anterior: alloc.stock_lote_anterior,
        stock_nuevo: alloc.stock_lote_nuevo,
        costo_unitario: alloc.costo_unitario,
        motivo: `Venta #${saleId.slice(0, 8)} (FIFO)`,
        referencia_id: saleId,
        usuario: user,
      })
      storeOps.push({ store: STORES.MOVIMIENTOS, record: mov })
    }
  }

  const metodoPago = String(options.metodo_pago || 'Efectivo').trim()
  const montoRecibido =
    options.monto_recibido != null && options.monto_recibido !== ''
      ? roundMoney(options.monto_recibido)
      : totalVenta

  if (metodoPago === 'Efectivo' && montoRecibido < totalVenta) {
    throw new Error(
      `El monto recibido ($${montoRecibido}) es menor al total a cobrar ($${totalVenta}).`
    )
  }

  const cambioEntregado =
    metodoPago === 'Efectivo' ? calculateChange(montoRecibido, totalVenta) : 0

  const ventaRecord = {
    id: saleId,
    tienda_id: tiendaId,
    fecha_venta: nowISO,
    total: totalVenta,
    metodo_pago: metodoPago,
    monto_recibido: montoRecibido,
    cambio_entregado: cambioEntregado,
    cliente_nombre: options.cliente_nombre ? String(options.cliente_nombre).trim() : null,
    notas: options.notas ? String(options.notas).trim() : null,
    usuario_id: user?.id || 'usr-tendero',
    vendedor_nombre: user?.nombre || 'Tendero',
    vendedor_rol: user?.rol || 'tendero',
    estado: 'COMPLETADA',
    motivo_anulacion: null,
    anulada_en: null,
    anulada_por: null,
    detalles,
  }

  storeOps.push({ store: STORES.VENTAS, record: ventaRecord })
  await putManyInStores(storeOps)

  return ventaRecord
}

/**
 * Anula una venta y devuelve exactamente las unidades descontadas a sus lotes originales.
 * Solo disponible para el rol Dueño ('admin').
 */
export async function cancelSale(ventaId, motivo = '', user) {
  assertOwnerPermission(user, 'anular ventas y revertir lotes')
  const cleanReason = String(motivo || '').trim()
  if (cleanReason.length < 3) {
    throw new Error('Debe indicar un motivo válido de anulación (mínimo 3 caracteres).')
  }

  const venta = await getById(STORES.VENTAS, ventaId)
  if (!venta) {
    throw new Error('No se encontró la venta a anular.')
  }
  if (venta.estado === 'ANULADA') {
    throw new Error('Esta venta ya fue anulada previamente.')
  }

  const ops = []
  const nowISO = new Date().toISOString()

  for (const det of venta.detalles || []) {
    for (const asig of det.asignaciones_lote || []) {
      const lote = await getById(STORES.LOTES, asig.lote_id)
      const qtyToRestore = roundQty(asig.cantidad_descontada)
      if (lote) {
        const prevStock = roundQty(lote.cantidad_disponible)
        const newStock = roundQty(prevStock + qtyToRestore)
        const restoredLot = {
          ...lote,
          cantidad_disponible: newStock,
          updated_at: nowISO,
        }
        ops.push({ store: STORES.LOTES, record: restoredLot })

        const mov = createMovementRecord({
          tienda_id: venta.tienda_id,
          producto_id: det.producto_id,
          producto_nombre: det.producto_nombre,
          lote_id: lote.id,
          codigo_lote: lote.codigo_lote,
          tipo: 'anulacion_venta',
          cantidad: qtyToRestore,
          stock_anterior: prevStock,
          stock_nuevo: newStock,
          costo_unitario: asig.costo_unitario,
          motivo: `Anulación venta #${venta.id.slice(0, 8)}: ${cleanReason}`,
          referencia_id: venta.id,
          usuario: user,
        })
        ops.push({ store: STORES.MOVIMIENTOS, record: mov })
      } else {
        // Si el lote fue eliminado manualmente, se recrea para no perder las unidades devueltas
        const recreatedLot = {
          id: asig.lote_id,
          tienda_id: venta.tienda_id,
          producto_id: det.producto_id,
          codigo_lote: asig.codigo_lote || 'L-REVERTIDO',
          fecha_entrada: asig.fecha_entrada || getTodayISO(),
          fecha_vencimiento: asig.fecha_vencimiento || null,
          costo_unitario: roundMoney(asig.costo_unitario),
          cantidad_inicial: qtyToRestore,
          cantidad_disponible: qtyToRestore,
          notas: 'Lote recreado por anulación de venta',
          created_at: nowISO,
          updated_at: nowISO,
        }
        ops.push({ store: STORES.LOTES, record: recreatedLot })
      }
    }
  }

  const updatedSale = {
    ...venta,
    estado: 'ANULADA',
    motivo_anulacion: cleanReason,
    anulada_en: nowISO,
    anulada_por: user?.nombre || 'Dueño',
  }
  ops.push({ store: STORES.VENTAS, record: updatedSale })

  await putManyInStores(ops)
  return updatedSale
}
