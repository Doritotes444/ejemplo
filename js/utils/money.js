/**
 * Utilidades de formato y cálculo monetario (COP - Pesos Colombianos)
 */

export const BILLETES_RAPIDOS = [2000, 5000, 10000, 20000, 50000, 100000]

export function roundMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 100) / 100
}

export function formatCOP(value) {
  const num = roundMoney(value)
  return `$${num.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export function formatNumber(value, maxDecimals = 0) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}

export function calculateChange(received, total) {
  const rec = roundMoney(received)
  const tot = roundMoney(total)
  if (rec <= tot) return 0
  return roundMoney(rec - tot)
}
