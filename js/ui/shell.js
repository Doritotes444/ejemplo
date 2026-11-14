import { isOwner } from '../core/permissions.js'
import { getTheme, toggleTheme } from '../core/theme.js'
import { navigateTo } from '../core/router.js'
import { logoutSession } from '../core/session.js'
import { getState, setState } from '../state.js'
import { BRAND_LOGO_SVG, icon } from './icons.js'
import { renderAuthScreen } from './login.js'
import { renderPOSViewHTML, bindPOSViewEvents, submitCurrentSale } from './pos.js'
import {
  renderProductsViewHTML,
  bindProductsViewEvents,
  renderLotsViewHTML,
  bindLotsViewEvents,
  renderInventoryViewHTML,
  bindInventoryViewEvents,
  renderSalesViewHTML,
  bindSalesViewEvents,
  renderUsersViewHTML,
  bindUsersViewEvents,
} from './lots.js'

/**
 * Shell Principal de la SPA.
 * - Si no hay sesión activa, renderiza la pantalla de Inicio de Sesión / Inicialización.
 * - Si el rol es TENDERO: muestra una barra limpia enfocada exclusivamente en el POS (sin enlaces ni botones deshabilitados de administración).
 * - Si el rol es DUEÑO: despliega la navegación completa hacia POS, Productos, Lotes, Inventario, Ventas y Usuarios.
 */

const OWNER_NAV_ITEMS = [
  { id: 'pos', label: 'Punto de Venta', iconName: 'pos' },
  { id: 'products', label: 'Productos', iconName: 'products' },
  { id: 'lots', label: 'Lotes y Vencimientos', iconName: 'lots' },
  { id: 'inventory', label: 'Inventario / Kardex', iconName: 'inventory' },
  { id: 'sales', label: 'Ventas', iconName: 'sales' },
  { id: 'users', label: 'Usuarios', iconName: 'users' },
]

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderAppShell(root, { onAuthenticated, onLogout, refreshAll }) {
  if (!root) return
  const st = getState()

  if (st.booting) {
    root.innerHTML = `
      <div class="boot-screen">
        <div class="boot-brand">${BRAND_LOGO_SVG}</div>
        <span class="boot-status">Cargando sistema...</span>
      </div>
    `
    return
  }

  if (!st.user) {
    renderAuthScreen(root, onAuthenticated)
    return
  }

  const owner = isOwner(st.user)
  const theme = getTheme()
  const activeRoute = owner ? st.route || 'pos' : 'pos'

  let viewContentHTML = ''
  if (!owner || activeRoute === 'pos') {
    viewContentHTML = renderPOSViewHTML(st)
  } else if (activeRoute === 'products') {
    viewContentHTML = renderProductsViewHTML(st)
  } else if (activeRoute === 'lots') {
    viewContentHTML = renderLotsViewHTML(st)
  } else if (activeRoute === 'inventory') {
    viewContentHTML = renderInventoryViewHTML(st)
  } else if (activeRoute === 'sales') {
    viewContentHTML = renderSalesViewHTML(st)
  } else if (activeRoute === 'users') {
    viewContentHTML = renderUsersViewHTML(st)
  } else {
    viewContentHTML = renderPOSViewHTML(st)
  }

  // Navegación: el Tendero NO ve pestañas administrativas ni botones deshabilitados
  const navHTML = owner
    ? `
      <nav class="app-nav" aria-label="Módulos del sistema">
        ${OWNER_NAV_ITEMS.map(
          (item) => `
            <button
              type="button"
              class="nav-item ${activeRoute === item.id ? 'active' : ''}"
              data-nav-route="${item.id}"
            >
              ${icon(item.iconName, 15)}
              <span>${item.label}</span>
            </button>
          `
        ).join('')}
      </nav>
    `
    : `
      <div class="tendero-workspace-indicator">
        ${icon('pos', 15)}
        <span>Terminal de Punto de Venta</span>
      </div>
    `

  root.innerHTML = `
    <div class="app-frame">
      <header class="app-header">
        <div class="header-left">
          <a href="#/pos" class="header-brand" aria-label="Kairo POS">
            ${BRAND_LOGO_SVG}
          </a>
          ${navHTML}
        </div>

        <div class="header-right">
          <button
            type="button"
            class="btn-icon"
            id="btn-header-theme"
            title="${theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}"
            aria-label="Cambiar tema de color"
          >
            ${theme === 'dark' ? icon('sun', 16) : icon('moon', 16)}
          </button>

          <div class="user-pill">
            <span class="user-role-dot ${owner ? 'dot-owner' : 'dot-tendero'}"></span>
            <span class="user-name">${escapeHTML(st.user.full_name)}</span>
            <span class="user-role-tag">${escapeHTML(st.user.role_name)}</span>
          </div>

          <button type="button" class="btn btn-ghost btn-sm" id="btn-header-logout" title="Cerrar sesión">
            ${icon('logout', 15)}
            <span>Salir</span>
          </button>
        </div>
      </header>

      ${
        st.toast
          ? `
        <div class="toast-notification toast-${st.toast.type}" role="status">
          <span>${escapeHTML(st.toast.message)}</span>
          <button type="button" class="btn-icon btn-icon-subtle" id="btn-close-toast" aria-label="Cerrar notificación">
            ${icon('close', 14)}
          </button>
        </div>
      `
          : ''
      }

      <main class="app-main">
        ${viewContentHTML}
      </main>
    </div>
  `

  // Eventos globales de cabecera
  root.querySelectorAll('[data-nav-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo(btn.getAttribute('data-nav-route'))
    })
  })

  root.querySelector('#btn-header-theme')?.addEventListener('click', () => {
    toggleTheme()
    renderAppShell(root, { onAuthenticated, onLogout, refreshAll })
  })

  root.querySelector('#btn-header-logout')?.addEventListener('click', async () => {
    await logoutSession()
    if (typeof onLogout === 'function') {
      onLogout()
    }
  })

  root.querySelector('#btn-close-toast')?.addEventListener('click', () => {
    setState({ toast: null })
  })

  // Enlazar eventos de la vista activa
  if (!owner || activeRoute === 'pos') {
    bindPOSViewEvents(root, refreshAll)
  } else if (activeRoute === 'products') {
    bindProductsViewEvents(root, refreshAll)
  } else if (activeRoute === 'lots') {
    bindLotsViewEvents(root, refreshAll)
  } else if (activeRoute === 'inventory') {
    bindInventoryViewEvents(root, refreshAll)
  } else if (activeRoute === 'sales') {
    bindSalesViewEvents(root)
  } else if (activeRoute === 'users') {
    bindUsersViewEvents(root, refreshAll)
  }
}

export function bindKeyboardShortcuts(refreshAll) {
  window.addEventListener('keydown', (e) => {
    const st = getState()
    if (!st.user) return

    if (e.key === 'F2') {
      const onPos = !isOwner(st.user) || (st.route || 'pos') === 'pos'
      if (onPos && st.cart.length > 0) {
        e.preventDefault()
        submitCurrentSale(refreshAll)
      }
    } else if (e.key === 'Escape') {
      const dialog = document.querySelector('.dialog-backdrop')
      if (dialog) {
        dialog.remove()
      }
    }
  })
}
