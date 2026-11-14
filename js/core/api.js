/**
 * Cliente HTTP para comunicación con el servidor Kairo POS.
 * Envía cookies de sesión HttpOnly y respaldo de token Bearer en memoria/sesión,
 * gestiona errores de autorización (401/403) y validación (400/409).
 */

const TOKEN_STORAGE_KEY = 'kairo_session_token'

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    }
  } catch {
    // ignore storage errors
  }
}

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const config = {
    method: options.method || 'GET',
    headers,
    credentials: 'same-origin',
  }

  if (options.body !== undefined) {
    config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  const response = await fetch(path, config)
  let data = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const errMessage = data?.error || `Error HTTP ${response.status}`
    if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/status') {
      setStoredToken('')
      window.dispatchEvent(new CustomEvent('kairo:unauthorized'))
    }
    throw new ApiError(errMessage, response.status)
  }

  return data
}
