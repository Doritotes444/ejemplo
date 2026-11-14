import { initTheme } from './core/theme.js'
import { isOwner } from './core/permissions.js'
import { initRouter, parseCurrentRoute, navigateTo } from './core/router.js'
import { fetchAuthStatus } from './core/session.js'
import {
  getState,
  setState,
  subscribe,
  syncCartWithProducts,
  showToast,
} from './state.js'
import { fetchCategories, fetchProducts } from './services/products.js'
import { fetchLots } from './services/lots.js'
import { fetchInventoryMovements } from './services/inventory.js'
import { fetchSales } from './services/sales.js'
import { fetchUsers } from './services/users.js'
import { renderAppShell, bindKeyboardShortcuts } from './ui/shell.js'

/**
 * Inicializador Principal de la Aplicación Kairo POS & Inventario.
 */

export async function refreshAllData() {
  const st = getState()
  if (!st.user) return

  const owner = isOwner(st.user)
  const [categories, products] = await Promise.all([
    fetchCategories(),
    fetchProducts(owner),
  ])

  const patch = {
    categories,
    products,
  }

  if (owner) {
    const [lots, movements, salesData, users] = await Promise.all([
      fetchLots(),
      fetchInventoryMovements(),
      fetchSales({
        date_from: st.salesFilterFrom,
        date_to: st.salesFilterTo,
        user_id: st.salesFilterUser,
        product_id: st.salesFilterProduct,
        payment_method: st.salesFilterMethod,
      }),
      fetchUsers(),
    ])
    patch.lots = lots
    patch.movements = movements
    patch.sales = salesData.sales || []
    patch.salesSummary = salesData.summary
    patch.users = users
  }

  setState(patch, false)
  syncCartWithProducts(products)
  setState({ cart: getState().cart }, true)
}

async function handleAuthenticated(user) {
  const initialRoute = isOwner(user) ? parseCurrentRoute() : 'pos'
  setState(
    {
      initialized: true,
      user,
      route: initialRoute,
      cart: [],
    },
    false
  )
  navigateTo(initialRoute, true)
  await refreshAllData()
}

function handleLogout() {
  setState({
    user: null,
    cart: [],
    route: 'pos',
    lastCompletedSale: null,
  })
}

async function bootstrap() {
  initTheme()

  const root = document.getElementById('app')
  subscribe(() => {
    renderAppShell(root, {
      onAuthenticated: handleAuthenticated,
      onLogout: handleLogout,
      refreshAll: refreshAllData,
    })
  })

  window.addEventListener('kairo:unauthorized', () => {
    handleLogout()
    showToast('error', 'Tu sesión ha expirado. Inicia sesión nuevamente.')
  })

  initRouter(() => {
    refreshAllData().catch(() => {})
  })
  bindKeyboardShortcuts(refreshAllData)

  try {
    const status = await fetchAuthStatus()
    setState(
      {
        booting: false,
        initialized: Boolean(status.initialized),
        user: status.user || null,
      },
      false
    )

    if (status.user) {
      await handleAuthenticated(status.user)
    } else {
      setState({ booting: false }, true)
    }
  } catch (err) {
    setState({ booting: false }, true)
    showToast('error', err.message || 'No se pudo conectar con el servidor.')
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap)
  } else {
    bootstrap()
  }
}
