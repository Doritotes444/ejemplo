import { ROLES, getRoleLabel } from './permissions.js'

/**
 * Sesión local de tienda y usuario activo.
 * Permite cambiar rápidamente entre 'Tendero' (interfaz bloqueada solo para vender)
 * y 'Dueño' (acceso completo a productos y lotes FIFO en la misma pantalla),
 * con soporte opcional de PIN para proteger el cambio a Dueño en mostrador.
 */

const SESSION_STORAGE_KEY = 'tiendapp_active_session'
const OWNER_PIN_STORAGE_KEY = 'tiendapp_owner_pin'

export const DEFAULT_TIENDA_ID = 'tienda-don-chucho-neiva'
export const DEFAULT_TIENDA_NOMBRE = 'Tienda Don Chucho · Las Granjas'

export const DEFAULT_USERS = {
  tendero: {
    id: 'usr-tendero-01',
    nombre: 'Camila Vargas',
    rol: ROLES.TENDERO,
    tienda_id: DEFAULT_TIENDA_ID,
    tienda_nombre: DEFAULT_TIENDA_NOMBRE,
  },
  admin: {
    id: 'usr-admin-01',
    nombre: 'Don Chucho',
    rol: ROLES.ADMIN,
    tienda_id: DEFAULT_TIENDA_ID,
    tienda_nombre: DEFAULT_TIENDA_NOMBRE,
  },
}

let activeUser = { ...DEFAULT_USERS.tendero }

export function loadSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && (parsed.rol === ROLES.ADMIN || parsed.rol === ROLES.TENDERO)) {
          activeUser = {
            ...DEFAULT_USERS[parsed.rol],
            ...parsed,
          }
          return activeUser
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  activeUser = { ...DEFAULT_USERS.tendero }
  return activeUser
}

export function getSessionUser() {
  return {
    ...activeUser,
    rol_label: getRoleLabel(activeUser.rol),
  }
}

export function setSessionRole(rol, customName = null) {
  const targetRole = rol === ROLES.ADMIN ? ROLES.ADMIN : ROLES.TENDERO
  const base = DEFAULT_USERS[targetRole]
  activeUser = {
    ...base,
    nombre: customName ? String(customName).trim() : base.nombre,
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(activeUser))
    }
  } catch {
    // ignore
  }
  return getSessionUser()
}

export function getOwnerPin() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(OWNER_PIN_STORAGE_KEY) || ''
    }
  } catch {
    // ignore
  }
  return ''
}

export function setOwnerPin(pin) {
  const clean = String(pin || '').trim()
  try {
    if (typeof localStorage !== 'undefined') {
      if (!clean) {
        localStorage.removeItem(OWNER_PIN_STORAGE_KEY)
      } else {
        localStorage.setItem(OWNER_PIN_STORAGE_KEY, clean)
      }
    }
  } catch {
    // ignore
  }
}

export function verifyOwnerPin(inputPin) {
  const currentPin = getOwnerPin()
  if (!currentPin) return true
  return String(inputPin || '').trim() === currentPin
}

export function getCartStorageKey(user = activeUser) {
  const tiendaId = user?.tienda_id || DEFAULT_TIENDA_ID
  const userId = user?.id || 'anon'
  return `tiendapp_cart:${tiendaId}:${userId}`
}
