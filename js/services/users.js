import { apiRequest } from '../core/api.js'

/**
 * Servicio de Administración de Usuarios (Exclusivo Dueño).
 */

export async function fetchUsers() {
  const res = await apiRequest('/api/users')
  return res.users || []
}

export async function createUserRequest(payload) {
  const res = await apiRequest('/api/users', {
    method: 'POST',
    body: payload,
  })
  return res.user
}

export async function updateUserRequest(userId, payload) {
  const res = await apiRequest(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: payload,
  })
  return res.user
}
