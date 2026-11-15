/**
 * Definición de Roles y Permisos en el Cliente.
 * - TENDERO: acceso a POS y al Muro de Reseñas privado (ningún acceso administrativo a inventario/lotes/productos/usuarios).
 * - DUEÑO: acceso completo a POS, Productos, Lotes, Inventario/Kardex, Ventas, Usuarios, Muro de Reseñas y Ajustes.
 */

export const ROLES = {
  DUENO: 'dueno',
  TENDERO: 'tendero',
}

export const OWNER_ROUTES = new Set([
  'pos',
  'products',
  'inventory',
  'lots',
  'sales',
  'users',
  'reviews',
  'settings',
])

export const TENDERO_ROUTES = new Set(['pos', 'reviews'])

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
