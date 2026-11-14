/**
 * Definición de Roles y Permisos en el Cliente.
 * NOTA: La autorización real se aplica estrictamente en el servidor (backend/security.py).
 * Este módulo adapta la interfaz SPA para que al Tendero nunca le aparezcan vistas ni
 * controles administrativos.
 */

export const ROLES = {
  DUENO: 'dueno',
  TENDERO: 'tendero',
}

export const OWNER_ROUTES = new Set(['pos', 'products', 'inventory', 'lots', 'sales', 'users'])
export const TENDERO_ROUTES = new Set(['pos'])

export function isOwner(user) {
  return user?.role === ROLES.DUENO
}

export function isTendero(user) {
  return user?.role === ROLES.TENDERO
}

export function isRouteAllowed(user, route) {
  if (!user) return false
  if (isOwner(user)) {
    return OWNER_ROUTES.has(route)
  }
  return TENDERO_ROUTES.has(route)
}
