import { getTodayISO } from '../utils/validation.js'

export { getTodayISO }

export function sumarDiasISO(fechaISO, dias) {
  const [y, m, d] = String(fechaISO).slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + Number(dias)))
  return dt.toISOString().slice(0, 10)
}
