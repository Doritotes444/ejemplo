import authService from './authService'
import { parseApiError } from '../utils/apiError'

const BASE = import.meta.env.VITE_API_URL || '/api'

async function parseJsonSafe(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Servicio frontend para gestión de cajeros/empleados.
 * Contratos respaldados por app/routers/usuarios.py
 */
const usuarioService = {
  /**
   * Lista todos los cajeros pertenecientes a la empresa del admin autenticado.
   * GET /api/usuarios/empleados
   */
  async listarEmpleados() {
    const res = await authService.fetchAuth(`${BASE}/usuarios/empleados`)
    if (!res.ok) {
      const data = await parseJsonSafe(res)
      throw new Error(parseApiError(data, 'Error al listar los cajeros del equipo'))
    }
    const data = await parseJsonSafe(res)
    return data || []
  },

  /**
   * Registra un nuevo cajero en la empresa.
   * POST /api/usuarios/empleados
   * payload: { nombre: string, email: string, password: string }
   */
  async crearEmpleado(payload) {
    const res = await authService.fetchAuth(`${BASE}/usuarios/empleados`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await parseJsonSafe(res)
      const detail = data?.detail
      const mensajeLimpio = parseApiError(data, 'Error al registrar cajero')
      const err = new Error(mensajeLimpio)
      err.status = res.status
      if (
        res.status === 403 &&
        ((typeof detail === 'string' &&
          (detail.toLowerCase().includes('límite de 3 cajeros') ||
            detail.includes('LIMIT_CAJEROS_REACHED'))) ||
          mensajeLimpio.toLowerCase().includes('límite de 3 cajeros'))
      ) {
        err.isLimitReached = true
        err.code = 'LIMIT_CAJEROS_REACHED'
      }
      throw err
    }

    return parseJsonSafe(res)
  },

  /**
   * Activa o desactiva a un cajero.
   * PATCH /api/usuarios/empleados/{cajero_id}/estado
   * payload: { is_active: boolean }
   */
  async cambiarEstadoEmpleado(cajeroId, isActive) {
    const res = await authService.fetchAuth(`${BASE}/usuarios/empleados/${cajeroId}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: Boolean(isActive) }),
    })

    if (!res.ok) {
      const data = await parseJsonSafe(res)
      const detail = data?.detail
      const mensajeLimpio = parseApiError(data, 'Error al cambiar estado del cajero')
      const err = new Error(mensajeLimpio)
      err.status = res.status
      if (
        res.status === 403 &&
        ((typeof detail === 'string' &&
          (detail.toLowerCase().includes('límite de 3 cajeros') ||
            detail.includes('LIMIT_CAJEROS_REACHED'))) ||
          mensajeLimpio.toLowerCase().includes('límite de 3 cajeros'))
      ) {
        err.isLimitReached = true
        err.code = 'LIMIT_CAJEROS_REACHED'
      }
      throw err
    }

    return parseJsonSafe(res)
  },
}

export default usuarioService
