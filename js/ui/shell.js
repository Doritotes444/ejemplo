import { isOwner } from '../core/permissions.js'
import { getTheme, toggleTheme } from '../core/theme.js'
import { navigateTo } from '../core/router.js'
import { logoutSession } from '../core/session.js'
import { getState, setState } from '../state.js'
import { computeOwnerQuickMetrics, getStoredProfileSync } from '../core/localStore.js'
import { formatCOP } from '../utils/money.js'
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

const OWNER_NAV_ITEMS = [
  { id: 'pos', label: 'Punto de Venta', iconName: 'pos' },
  { id: 'products', label: 'Productos', iconName: 'products' },
  { id: 'lots', label: 'Lotes (FEFO)', iconName: 'lots' },
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

/**
 * Renderiza el Panel de "Métricas Rápidas" exclusivo para la vista del Dueño:
 * 1. Ventas del Día (COP + número de transacciones + transferencias verificadas)
 * 2. Producto Más Vendido (nombre, SKU y unidades vendidas)
 * 3. Alerta de Bajo Stock (cantidad de productos en bajo stock con acceso directo)
 */
function renderOwnerQuickMetricsStrip(st) {
  if (!isOwner(st.user)) return ''
  const metrics = computeOwnerQuickMetrics(st.products || [], st.sales || [])
  const store = st.storeProfile || getStoredProfileSync()

  return `
    <section id="owner-quick-metrics" class="owner-metrics-banner" aria-label="Métricas Rápidas del Dueño">
      <div class="owner-store-summary">
        <div class="store-badge-icon">${icon('store', 16)}</div>
        <div>
          <strong class="store-title-text">${escapeHTML(store?.store_name || 'Mi Establecimiento')}</strong>
          <div class="store-meta-text">
            <span>NIT: ${escapeHTML(store?.nit || '—')}</span>
            <span>·</span>
            <span>${escapeHTML(store?.address || '')} (${escapeHTML(store?.neighborhood || '')})</span>
          </div>
        </div>
      </div>

      <div class="owner-kpi-grid">
        <div class="kpi-pill">
          <div class="kpi-top">
            <span class="kpi-label">Ventas del Día</span>
            <span class="status-badge badge-success">${metrics.today_sales_count} ops</span>
          </div>
          <strong class="kpi-value">${formatCOP(metrics.today_sales_total)}</strong>
          <span class="kpi-sub">${metrics.verified_transfers_count} transferencia(s) verificadas con cámara</span>
        </div>

        <div class="kpi-pill">
          <div class="kpi-top">
            <span class="kpi-label">Producto Más Vendido</span>
            ${icon('trending', 14, 'text-success')}
          </div>
          <strong class="kpi-value kpi-truncate" title="${escapeHTML(metrics.top_product.name)}">
            ${escapeHTML(metrics.top_product.name)}
          </strong>
          <span class="kpi-sub">
            ${
              metrics.top_product.quantity > 0
                ? `${metrics.top_product.quantity} und vendidas · ${formatCOP(metrics.top_product.revenue)}`
                : 'Registra una venta en el POS para calcular rotación'
            }
          </span>
        </div>

        <div class="kpi-pill ${metrics.low_stock_count > 0 ? 'kpi-pill-warning' : ''}">
          <div class="kpi-top">
            <span class="kpi-label">Alerta de Bajo Stock</span>
            <button type="button" class="btn-link-xs" id="btn-kpi-go-lowstock">Ver detalle →</button>
          </div>
          <strong class="kpi-value ${metrics.low_stock_count > 0 ? 'text-warning' : ''}">
            ${metrics.low_stock_count} productos
          </strong>
          <span class="kpi-sub">
            ${metrics.out_of_stock_count} agotados · ${(st.products || []).length} activos en catálogo
          </span>
        </div>
      </div>
    </section>
  `
}

export function renderAppShell(root, { onAuthenticated, onLogout, refreshAll }) {
  if (!root) return
  const st = getState()

  if (st.booting) {
    root.innerHTML = `
      <div class="boot-screen">
        <div class="boot-brand">${BRAND_LOGO_SVG}</div>
        <span class="boot-status">Cargando catálogo de 400 productos e IndexedDB...</span>
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
  const store = st.storeProfile || getStoredProfileSync()

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
        <span>POS · ${escapeHTML(store?.store_name || 'Caja Activa')}</span>
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

          <button type="button" class="btn btn-ghost btn-sm" id="btn-header-logout" title="Cambiar usuario o salir">
            ${icon('logout', 15)}
            <span class="hide-on-xs">Salir</span>
          </button>
        </div>
      </header>

      ${owner ? renderOwnerQuickMetricsStrip(st) : ''}

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

  root.querySelectorAll('[data-nav-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo(btn.getAttribute('data-nav-route'))
    })
  })

  root.querySelector('#btn-kpi-go-lowstock')?.addEventListener('click', () => {
    navigateTo('inventory')
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
