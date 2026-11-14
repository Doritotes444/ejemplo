import { STORES, generateId, getAllFromStore } from '../core/db.js'
import { DEFAULT_TIENDA_ID } from '../core/session.js'
import { roundQty } from '../utils/quantities.js'
import { roundMoney } from '../utils/money.js'

/**
 * Servicio de Movimientos de Inventario (Kardex por Lote).
 * Cada movimiento referencia el lote afectado, cantidad, tipo, usuario y fecha.
 */

export function createMovementRecord({
  tienda_id = DEFAULT_TIENDA_ID,
  producto_id,
  producto_nombre = null,
  lote_id,
  codigo_lote = null,
  tipo,
  cantidad,
  stock_anterior,
  stock_nuevo,
  costo_unitario = 0,
  motivo = '',
  referencia_id = null,
  usuario = null,
}) {
  return {
    id: generateId('mov'),
    tienda_id,
    producto_id,
    producto_nombre,
    lote_id,
    codigo_lote,
    tipo, // 'entrada_lote' | 'ajuste_lote' | 'venta_fifo' | 'anulacion_venta' | 'baja_lote'
    cantidad: roundQty(cantidad),
    stock_anterior: roundQty(stock_anterior),
    stock_nuevo: roundQty(stock_nuevo),
    costo_unitario: roundMoney(costo_unitario),
    motivo: String(motivo || '').trim(),
    referencia_id,
    usuario_id: usuario?.id || 'usr-sistema',
    usuario_nombre: usuario?.nombre || 'Sistema',
    usuario_rol: usuario?.rol || 'admin',
    created_at: new Date().toISOString(),
  }
}

export async function listMovements(tiendaId = DEFAULT_TIENDA_ID, filters = {}) {
  const all = await getAllFromStore(STORES.MOVIMIENTOS, tiendaId)
  let filtered = all

  if (filters.producto_id) {
    filtered = filtered.filter((m) => m.producto_id === filters.producto_id)
  }
  if (filters.lote_id) {
    filtered = filtered.filter((m) => m.lote_id === filters.lote_id)
  }
  if (filters.tipo) {
    filtered = filtered.filter((m) => m.tipo === filters.tipo)
  }

  return filtered.sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )
}
