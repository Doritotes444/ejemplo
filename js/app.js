import { initTheme } from './core/theme.js'
import { loadSession } from './core/session.js'
import {
  getState,
  setState,
  subscribe,
  loadSavedCartForCurrentUser,
  reconcileCartWithCatalog,
} from './state.js'
import { ensureDemoDataIfEmpty } from './services/backup.js'
import { listProductsWithStock } from './services/products.js'
import { listLots } from './services/lots.js'
import { listSales } from './services/sales.js'
import { listMovements } from './services/inventory.js'
import { renderAppShell, bindGlobalShortcuts } from './ui/shell.js'

/**
 * Punto de entrada de la SPA Tiendapp (100 % Vanilla JS + CSS3 + IndexedDB).
 */

export async function refreshAllData() {
  const user = getState().user
  const tiendaId = user.tienda_id

  const [products, lots, sales, movements] = await Promise.all([
    listProductsWithStock(tiendaId),
    listLots(tiendaId),
    listSales(tiendaId),
    listMovements(tiendaId),
  ])

  setState(
    {
      products,
      lots,
      sales,
      movements,
    },
    false
  )
  reconcileCartWithCatalog(products)
  setState({ cart: getState().cart }, true)
}

async function bootstrap() {
  initTheme()
  const sessionUser = loadSession()
  setState({ user: sessionUser }, false)
  loadSavedCartForCurrentUser()

  await ensureDemoDataIfEmpty(sessionUser.tienda_id)

  const appRoot = document.getElementById('app')
  subscribe(() => {
    renderAppShell(appRoot, refreshAllData)
  })

  bindGlobalShortcuts(refreshAllData)
  await refreshAllData()
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap)
  } else {
    bootstrap()
  }
}
