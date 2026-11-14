/**
 * Control de roles y permisos en la SPA.
 * RolUsuario conserva 'admin' (mostrado como "Dueño") y 'tendero' ("Tendero").
 * NOTA: Al ser una aplicación 100 % local en el navegador, esta capa bloquea y separa
 * la interfaz operativa para evitar errores accidentales del Tendero, además de validar
 * cada llamada en los servicios de negocio.
 */

export const ROLES = {
  ADMIN: 'admin',
  TENDERO: 'tendero',
}

export function getRoleLabel(rol) {
  return rol === ROLES.ADMIN ? 'Dueño' : 'Tendero'
}

export function isOwner(user) {
  return user?.rol === ROLES.ADMIN
}

export function isShopkeeper(user) {
  return user?.rol === ROLES.TENDERO
}

export function canSell(user) {
  return Boolean(user && (user.rol === ROLES.ADMIN || user.rol === ROLES.TENDERO))
}

export function canManageCatalog(user) {
  return isOwner(user)
}

export function canManageLots(user) {
  return isOwner(user)
}

export function canCancelSales(user) {
  return isOwner(user)
}

export function canManageBackups(user) {
  return isOwner(user)
}

export function assertOwnerPermission(user, actionLabel = 'realizar esta operación') {
  if (!isOwner(user)) {
    throw new Error(`Permiso denegado: Solo el Dueño puede ${actionLabel}.`)
  }
}
