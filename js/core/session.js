import { apiRequest, setStoredToken } from './api.js'

/**
 * Gestión de Autenticación y Sesión con el Backend Real.
 */

export async function fetchAuthStatus() {
  return apiRequest('/api/auth/status')
}

export async function setupOwnerAccount(payload) {
  const data = await apiRequest('/api/auth/setup', {
    method: 'POST',
    body: payload,
  })
  if (data?.token) {
    setStoredToken(data.token)
  }
  return data
}

export async function loginWithCredentials(username, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
  if (data?.token) {
    setStoredToken(data.token)
  }
  return data
}

export async function logoutSession() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' })
  } finally {
    setStoredToken('')
  }
}
