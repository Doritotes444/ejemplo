import { roundQty } from './quantities.js'
import { roundMoney } from './money.js'

/**
 * Validaciones de dominio y fechas (Zona horaria Colombia / ISO YYYY-MM-DD)
 */

export function getTodayISO() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function isLotExpired(fechaVencimiento, referenceDateISO = getTodayISO()) {
  if (!fechaVencimiento) return false
  const cleanExp = String(fechaVencimiento).trim().slice(0, 10)
  const cleanRef = String(referenceDateISO).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanExp)) return false
  return cleanExp < cleanRef
}

export function daysUntilExpiration(fechaVencimiento, referenceDateISO = getTodayISO()) {
  if (!fechaVencimiento) return null
  const [ey, em, ed] = String(fechaVencimiento).slice(0, 10).split('-').map(Number)
  const [ry, rm, rd] = String(referenceDateISO).slice(0, 10).split('-').map(Number)
  if (!ey || !ry) return null
  const expMs = Date.UTC(ey, em - 1, ed)
  const refMs = Date.UTC(ry, rm - 1, rd)
  return Math.round((expMs - refMs) / (1000 * 60 * 60 * 24))
}

export function validateProductPayload(payload) {
  const errors = []
  const nombre = String(payload?.nombre || '').trim()
  const codigo = String(payload?.codigo_barras || '').trim()
  const precioVenta = roundMoney(payload?.precio_venta)
  const stockMinimo = roundQty(payload?.stock_minimo ?? 5)

  if (nombre.length < 2) {
    errors.push('El nombre del producto debe tener al menos 2 caracteres.')
  }
  if (!codigo) {
    errors.push('El código de barras o SKU es obligatorio.')
  }
  if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
    errors.push('El precio de venta debe ser mayor a $0.')
  }
  if (stockMinimo < 0) {
    errors.push('El stock mínimo no puede ser negativo.')
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned: {
      nombre,
      codigo_barras: codigo,
      categoria: String(payload?.categoria || 'Abarrotes').trim(),
      unidad_medida: String(payload?.unidad_medida || 'unidad').trim().toLowerCase(),
      precio_venta: precioVenta,
      stock_minimo: stockMinimo,
      es_frecuente: Boolean(payload?.es_frecuente),
      foto_url: payload?.foto_url || null,
    },
  }
}

export function validateLotPayload(payload) {
  const errors = []
  const codigoLote = String(payload?.codigo_lote || '').trim()
  const cantidad = roundQty(payload?.cantidad_disponible ?? payload?.cantidad_inicial)
  const costoUnitario = roundMoney(payload?.costo_unitario)
  const fechaEntrada = String(payload?.fecha_entrada || getTodayISO()).trim().slice(0, 10)
  const fechaVencimiento = payload?.fecha_vencimiento
    ? String(payload.fecha_vencimiento).trim().slice(0, 10)
    : null

  if (!codigoLote) {
    errors.push('El código del lote es obligatorio.')
  }
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    errors.push('La cantidad del lote debe ser un número válido mayor o igual a 0.')
  }
  if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
    errors.push('El costo unitario del lote no puede ser negativo.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEntrada)) {
    errors.push('La fecha de entrada debe tener formato YYYY-MM-DD.')
  }
  if (fechaVencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento)) {
    errors.push('La fecha de vencimiento debe tener formato YYYY-MM-DD.')
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned: {
      codigo_lote: codigoLote,
      cantidad_disponible: cantidad,
      costo_unitario: costoUnitario,
      fecha_entrada: fechaEntrada,
      fecha_vencimiento: fechaVencimiento || null,
    },
  }
}
