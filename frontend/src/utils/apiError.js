/**
 * Normaliza y formatea errores provenientes de la API (FastAPI / Pydantic v2).
 * Evita exponer estructuras internas JSON como "value_error", "loc" o "ctx" al usuario final.
 */

export function parseApiError(errorData, fallbackMessage = 'Ocurrió un error inesperado al procesar la solicitud.') {
  if (!errorData) return fallbackMessage

  // Si ya es un string simple
  if (typeof errorData === 'string') {
    return limpiarMensaje(errorData)
  }

  // Si viene estructurado con code y message personalizado
  if (errorData.message && typeof errorData.message === 'string') {
    return limpiarMensaje(errorData.message)
  }

  const detail = errorData.detail !== undefined ? errorData.detail : errorData

  // Si detail es string
  if (typeof detail === 'string') {
    return limpiarMensaje(detail)
  }

  // Si detail es un array de errores de validación de Pydantic (HTTP 422)
  if (Array.isArray(detail)) {
    const mensajes = []

    for (const item of detail) {
      if (!item) continue

      // Extraer nombre del campo
      const campo = Array.isArray(item.loc) && item.loc.length > 0
        ? String(item.loc[item.loc.length - 1]).toLowerCase()
        : ''

      // Caso especial: contraseña no cumple con políticas de seguridad
      if (campo === 'password' || campo === 'contraseña') {
        mensajes.push(
          'La contraseña no cumple con las reglas de seguridad: debe incluir al menos 8 caracteres, una letra mayúscula, una letra minúscula, un número y un carácter especial (ej: Clave123!).'
        )
        continue
      }

      // Caso especial: email inválido
      if (campo === 'email' || campo === 'correo') {
        mensajes.push('El correo electrónico ingresado no tiene un formato válido.')
        continue
      }

      // Caso genérico con msg limpio
      if (item.msg && typeof item.msg === 'string') {
        mensajes.push(limpiarMensaje(item.msg))
      }
    }

    if (mensajes.length > 0) {
      return mensajes.join(' ')
    }
  }

  return fallbackMessage
}

/**
 * Limpia prefijos automáticos de Pydantic como "Value error, " y asegura mayúscula inicial.
 */
function limpiarMensaje(msg) {
  if (!msg || typeof msg !== 'string') return ''
  let limpio = msg.replace(/^value error,\s*/i, '').replace(/^assertion error,\s*/i, '').trim()
  if (limpio.length > 0) {
    limpio = limpio.charAt(0).toUpperCase() + limpio.slice(1)
  }
  return limpio
}

export default parseApiError
