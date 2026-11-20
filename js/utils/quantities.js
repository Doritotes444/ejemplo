/**
 * Manejo de cantidades enteras y fraccionarias (granel: kg, libra, litro, gramo)
 * Con precisión de hasta 3 decimales para evitar errores de punto flotante en JS.
 */

export const UNIDADES_GRANEL = new Set([
  'kg',
  'kilo',
  'lb',
  'libra',
  'lt',
  'litro',
  'gr',
  'gramo',
  'ml',
  'm',
  'metro',
])

export function isBulkUnit(unidad) {
  return UNIDADES_GRANEL.has(String(unidad || '').trim().toLowerCase())
}

export function getUnitStep(unidad) {
  const u = String(unidad || '').trim().toLowerCase()
  if (u === 'gr' || u === 'gramo' || u === 'ml') return 50
  if (isBulkUnit(u)) return 0.25
  return 1
}

export function roundQty(value) {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 1000) / 1000
}

export function formatQty(value, unidad = 'unidad') {
  const q = roundQty(value)
  const text = q.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
  return unidad ? `${text} ${unidad}` : text
}

export function clampQty(value, maxAvailable) {
  const q = roundQty(value)
  const max = roundQty(maxAvailable)
  if (q <= 0 || max <= 0) return 0
  return Math.min(q, max)
}
