import { isRouteAllowed } from './permissions.js'
import { getState, setState, showToast } from '../state.js'

/**
 * Enrutador SPA sin recargas de página (History / Hash Routing).
 * Restringe automáticamente el acceso a rutas exclusivas del Dueño si el usuario es Tendero.
 */

export function parseCurrentRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase()
  return raw || 'pos'
}

export function navigateTo(route, replace = false) {
  const st = getState()
  if (!st.user) return

  let target = String(route || 'pos').toLowerCase()
  if (!isRouteAllowed(st.user, target)) {
    target = 'pos'
    if (route && route !== 'pos') {
      showToast('error', 'No tienes permiso para acceder a esa sección.')
    }
  }

  const nextHash = `#/${target}`
  if (window.location.hash !== nextHash) {
    if (replace) {
      window.history.replaceState(null, '', nextHash)
    } else {
      window.location.hash = nextHash
    }
  }
  setState({ route: target })
}

export function initRouter(onRouteChange) {
  window.addEventListener('hashchange', () => {
    const st = getState()
    if (!st.user) return
    const requested = parseCurrentRoute()
    if (!isRouteAllowed(st.user, requested)) {
      window.history.replaceState(null, '', '#/pos')
      setState({ route: 'pos' })
      showToast('error', 'Acceso restringido: redirigido al Punto de Venta.')
      return
    }
    setState({ route: requested })
    if (typeof onRouteChange === 'function') {
      onRouteChange(requested)
    }
  })
}
