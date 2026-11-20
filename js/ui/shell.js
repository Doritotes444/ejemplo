import { isOwner } from '../core/permissions.js'
import { getTheme, toggleTheme } from '../core/theme.js'
import { navigateTo } from '../core/router.js'
import { logoutSession } from '../core/session.js'
import { getState, setState, calculateCartTotals } from '../state.js'
import {
  computeOwnerQuickMetrics,
  getStoredProfileSync,
  getUISettingsSync,
  saveUISettingsSync,
} from '../core/localStore.js'
import { formatCOP } from '../utils/money.js'
import { BRAND_LOGO_SVG, icon } from './icons.js'
import { closeDialog } from './dialog.js'
import { renderAuthScreen } from './login.js'
import {
  renderPOSViewHTML,
  bindPOSViewEvents,
  submitCurrentSale,
  stopInline50vhScanner,
} from './pos.js'
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
import { renderReviewsViewHTML, bindReviewsViewEvents } from './reviews.js'
import { renderSettingsViewHTML, bindSettingsViewEvents } from './settings.js'
import { renderInteractiveTourHTML, bindInteractiveTourEvents } from './tour.js'

const OWNER_NAV_ITEMS = [
  { id: 'pos', label: 'Punto de Venta', iconName: 'pos' },
  { id: 'products', label: 'Productos', iconName: 'products' },
  { id: 'lots', label: 'Lotes (FEFO)', iconName: 'lots' },
  { id: 'inventory', label: 'Inventario / Kardex', iconName: 'inventory' },
  { id: 'sales', label: 'Ventas', iconName: 'sales' },
  { id: 'reviews', label: 'Muro de Reseñas', iconName: 'star' },
  { id: 'users', label: 'Usuarios', iconName: 'users' },
  { id: 'settings', label: 'Ajustes', iconName: 'settings' },
]

const TENDERO_NAV_ITEMS = [
  { id: 'pos', label: 'Terminal POS', iconName: 'pos' },
  { id: 'reviews', label: 'Muro de Reseñas', iconName: 'star' },
]

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
            ${metrics.out_of_stock_count} agotados · ${(st.products || []).length} en catálogo
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
        <span class="boot-status">Inicializando TiendApp...</span>
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
  const activeRoute = st.route || 'pos'
  const store = st.storeProfile || getStoredProfileSync()
  const ui = getUISettingsSync()
  const { total, itemsCount } = calculateCartTotals(st.cart)

  let viewContentHTML = ''
  if (activeRoute === 'pos') {
    viewContentHTML = renderPOSViewHTML(st)
  } else if (activeRoute === 'reviews') {
    viewContentHTML = renderReviewsViewHTML(st)
  } else if (owner && activeRoute === 'products') {
    viewContentHTML = renderProductsViewHTML(st)
  } else if (owner && activeRoute === 'lots') {
    viewContentHTML = renderLotsViewHTML(st)
  } else if (owner && activeRoute === 'inventory') {
    viewContentHTML = renderInventoryViewHTML(st)
  } else if (owner && activeRoute === 'sales') {
    viewContentHTML = renderSalesViewHTML(st)
  } else if (owner && activeRoute === 'users') {
    viewContentHTML = renderUsersViewHTML(st)
  } else if (owner && activeRoute === 'settings') {
    viewContentHTML = renderSettingsViewHTML(st)
  } else {
    viewContentHTML = renderPOSViewHTML(st)
  }

  const navItems = owner ? OWNER_NAV_ITEMS : TENDERO_NAV_ITEMS
  const activeNavMeta = navItems.find((item) => item.id === activeRoute) || navItems[0]

  root.innerHTML = `
    <div class="app-frame ${owner ? 'layout-owner-pc' : 'layout-tendero-mobile'}">
      <!-- Menú Lateral (Sidebar) para Versión PC -->
      <aside class="app-sidebar" aria-label="Menú lateral de navegación">
        <div class="sidebar-top">
          <a href="#/pos" class="sidebar-brand" aria-label="TiendApp Inicio">
            ${BRAND_LOGO_SVG}
          </a>
          <div class="sidebar-store-chip">
            <strong>${escapeHTML(store?.store_name || 'Mi Tienda')}</strong>
            <span>NIT ${escapeHTML(store?.nit || '—')}</span>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Módulos principales">
          ${navItems
            .map(
              (item) => `
              <button
                type="button"
                class="sidebar-nav-item nav-item ${activeRoute === item.id ? 'active' : ''}"
                data-nav-route="${item.id}"
                aria-current="${activeRoute === item.id ? 'page' : 'false'}"
              >
                ${icon(item.iconName, 16)}
                <span>${item.label}</span>
              </button>
            `
            )
            .join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="user-pill sidebar-user-pill">
            <span class="user-role-dot ${owner ? 'dot-owner' : 'dot-tendero'}"></span>
            <div class="sidebar-user-info">
              <span class="user-name">${escapeHTML(st.user.full_name)}</span>
              <span class="user-role-tag">${escapeHTML(st.user.role_name)}</span>
            </div>
          </div>

          <div class="sidebar-footer-actions">
            <button
              type="button"
              class="btn-icon"
              id="btn-sidebar-theme"
              title="Cambiar modo claro / oscuro"
              aria-label="Cambiar tema"
            >
              ${theme === 'dark' ? icon('sun', 16) : icon('moon', 16)}
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-sidebar-logout" title="Cerrar sesión">
              ${icon('logout', 15)}
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      ${
        owner && st.mobileMenuOpen
          ? `
        <div class="mobile-drawer-backdrop" id="mobile-drawer-backdrop">
          <aside class="mobile-owner-drawer" id="mobile-owner-drawer" role="dialog" aria-modal="true" aria-label="Menú administrativo">
            <div class="mobile-drawer-head">
              <div>
                <strong>${escapeHTML(store?.store_name || 'Mi Tienda')}</strong>
                <div class="cell-sub">${escapeHTML(st.user.full_name)} · ${escapeHTML(st.user.role_name)}</div>
              </div>
              <button type="button" class="btn-icon" id="btn-close-mobile-drawer" aria-label="Cerrar menú">
                ${icon('close', 16)}
              </button>
            </div>
            <nav class="sidebar-nav" aria-label="Módulos del dueño">
              ${navItems
                .map(
                  (item) => `
                  <button
                    type="button"
                    class="sidebar-nav-item nav-item ${activeRoute === item.id ? 'active' : ''}"
                    data-nav-route="${item.id}"
                  >
                    ${icon(item.iconName, 16)}
                    <span>${item.label}</span>
                  </button>
                `
                )
                .join('')}
            </nav>
            <div class="mobile-drawer-footer">
              <button type="button" class="btn btn-outline btn-sm btn-block" id="btn-drawer-cam50">
                ${icon('barcode', 15)}
                <span>${ui.inlineMobileScanner ? 'Desactivar Cámara 50%' : 'Activar Cámara 50% en POS'}</span>
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-block" id="btn-drawer-logout">
                ${icon('logout', 15)}
                <span>Cerrar sesión</span>
              </button>
            </div>
          </aside>
        </div>
      `
          : ''
      }

      <!-- Columna Principal de Contenido -->
      <div class="app-content-column">
        <!-- Cabecera Compacta Superior -->
        <header class="app-header">
          <div class="header-left">
            ${
              owner
                ? `
              <button
                type="button"
                class="btn-icon mobile-only-menu-btn"
                id="btn-header-mobile-menu"
                aria-label="Abrir menú de navegación"
              >
                ${icon('menu', 18)}
              </button>
            `
                : ''
            }
            <a href="#/pos" class="header-brand mobile-only-brand" aria-label="TiendApp">
              ${BRAND_LOGO_SVG}
            </a>
            <div class="desktop-route-crumb">
              ${icon(activeNavMeta.iconName, 15)}
              <span>${escapeHTML(activeNavMeta.label)}</span>
              ${activeRoute === 'pos' ? '<kbd class="kbd-hint">/</kbd><span class="crumb-hint">Buscar</span><kbd class="kbd-hint">F2</kbd><span class="crumb-hint">Cobrar</span>' : ''}
            </div>
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

        ${owner ? renderInteractiveTourHTML(st) : ''}
        ${owner ? renderOwnerQuickMetricsStrip(st) : ''}

        ${
          st.toast
            ? `
          <div class="toast-notification toast-${st.toast.type}" role="status" aria-live="polite">
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

      <!-- Barra de Navegación Inferior (Bottom Navigation Bar) para Versión Celular -->
      <nav class="app-bottom-nav" aria-label="Navegación móvil para el pulgar">
        <button
          type="button"
          class="bottom-nav-btn ${activeRoute === 'pos' && !st.mobileTicketOpen ? 'active' : ''}"
          data-nav-route="pos"
        >
          ${icon('pos', 18)}
          <span>POS</span>
        </button>

        ${
          owner
            ? `
          <button
            type="button"
            class="bottom-nav-btn ${activeRoute === 'products' ? 'active' : ''}"
            data-nav-route="products"
          >
            ${icon('products', 18)}
            <span>Productos</span>
          </button>
        `
            : `
          <button
            type="button"
            class="bottom-nav-btn ${ui.inlineMobileScanner ? 'active' : ''}"
            id="btn-bottom-cam50"
          >
            ${icon('barcode', 18)}
            <span>Cámara</span>
          </button>
        `
        }

        <button
          type="button"
          class="bottom-nav-thumb-pay ${itemsCount > 0 ? 'has-items' : ''}"
          id="btn-open-mobile-ticket"
        >
          ${icon('cart', 17)}
          <span>${itemsCount > 0 ? `${itemsCount} · ${formatCOP(total)}` : 'Ticket ($0)'}</span>
        </button>

        ${
          owner
            ? `
          <button
            type="button"
            class="bottom-nav-btn ${activeRoute === 'lots' ? 'active' : ''}"
            data-nav-route="lots"
          >
            ${icon('lots', 18)}
            <span>Lotes</span>
          </button>
          <button
            type="button"
            class="bottom-nav-btn ${st.mobileMenuOpen ? 'active' : ''}"
            id="btn-bottom-more-menu"
          >
            ${icon('menu', 18)}
            <span>Más</span>
          </button>
        `
            : `
          <button
            type="button"
            class="bottom-nav-btn ${activeRoute === 'reviews' ? 'active' : ''}"
            data-nav-route="reviews"
          >
            ${icon('star', 18)}
            <span>Reseñas</span>
          </button>
          <button type="button" class="bottom-nav-btn" id="btn-bottom-logout">
            ${icon('logout', 18)}
            <span>Salir</span>
          </button>
        `
        }
      </nav>
    </div>
  `

  root.querySelectorAll('[data-nav-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ mobileTicketOpen: false, mobileMenuOpen: false }, false)
      navigateTo(btn.getAttribute('data-nav-route'))
    })
  })

  const toggleMobileDrawer = () => {
    setState({ mobileMenuOpen: !getState().mobileMenuOpen, mobileTicketOpen: false })
  }
  root.querySelector('#btn-header-mobile-menu')?.addEventListener('click', toggleMobileDrawer)
  root.querySelector('#btn-bottom-more-menu')?.addEventListener('click', toggleMobileDrawer)
  root.querySelector('#btn-close-mobile-drawer')?.addEventListener('click', () => {
    setState({ mobileMenuOpen: false })
  })
  root.querySelector('#mobile-drawer-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'mobile-drawer-backdrop') {
      setState({ mobileMenuOpen: false })
    }
  })

  const handleToggleCam50 = async () => {
    const cur = getUISettingsSync()
    const next = !cur.inlineMobileScanner
    if (!next) await stopInline50vhScanner()
    saveUISettingsSync({ inlineMobileScanner: next })
    setState({ mobileMenuOpen: false, mobileTicketOpen: false }, false)
    if (st.route !== 'pos') navigateTo('pos')
    else setState({})
  }
  root.querySelector('#btn-bottom-cam50')?.addEventListener('click', handleToggleCam50)
  root.querySelector('#btn-drawer-cam50')?.addEventListener('click', handleToggleCam50)

  root.querySelector('#btn-open-mobile-ticket')?.addEventListener('click', () => {
    setState({ mobileMenuOpen: false }, false)
    if (st.route !== 'pos') {
      navigateTo('pos')
      setState({ mobileTicketOpen: true })
    } else {
      setState({ mobileTicketOpen: !st.mobileTicketOpen })
    }
  })

  root.querySelector('#btn-kpi-go-lowstock')?.addEventListener('click', () => {
    navigateTo('inventory')
  })

  const handleToggleTheme = () => {
    toggleTheme()
    renderAppShell(root, { onAuthenticated, onLogout, refreshAll })
  }
  root.querySelector('#btn-header-theme')?.addEventListener('click', handleToggleTheme)
  root.querySelector('#btn-sidebar-theme')?.addEventListener('click', handleToggleTheme)

  const handleDoLogout = async () => {
    await stopInline50vhScanner()
    await logoutSession()
    if (typeof onLogout === 'function') {
      onLogout()
    }
  }
  root.querySelector('#btn-header-logout')?.addEventListener('click', handleDoLogout)
  root.querySelector('#btn-sidebar-logout')?.addEventListener('click', handleDoLogout)
  root.querySelector('#btn-bottom-logout')?.addEventListener('click', handleDoLogout)
  root.querySelector('#btn-drawer-logout')?.addEventListener('click', handleDoLogout)

  root.querySelector('#btn-close-toast')?.addEventListener('click', () => {
    setState({ toast: null })
  })

  if (owner) {
    bindInteractiveTourEvents(root, refreshAll)
  }

  if (activeRoute === 'pos') {
    bindPOSViewEvents(root, refreshAll)
  } else if (activeRoute === 'reviews') {
    bindReviewsViewEvents(root)
  } else if (owner && activeRoute === 'products') {
    bindProductsViewEvents(root, refreshAll)
  } else if (owner && activeRoute === 'lots') {
    bindLotsViewEvents(root, refreshAll)
  } else if (owner && activeRoute === 'inventory') {
    bindInventoryViewEvents(root, refreshAll)
  } else if (owner && activeRoute === 'sales') {
    bindSalesViewEvents(root)
  } else if (owner && activeRoute === 'users') {
    bindUsersViewEvents(root, refreshAll)
  } else if (owner && activeRoute === 'settings') {
    bindSettingsViewEvents(root, refreshAll)
  } else {
    bindPOSViewEvents(root, refreshAll)
  }
}

export function bindKeyboardShortcuts(refreshAll) {
  window.addEventListener('keydown', (e) => {
    const st = getState()
    if (!st.user) return

    const activeTag = document.activeElement?.tagName?.toLowerCase() || ''
    const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select'

    if (e.key === 'F2') {
      const onPos = !isOwner(st.user) || (st.route || 'pos') === 'pos'
      if (onPos && st.cart.length > 0 && !document.querySelector('.dialog-backdrop')) {
        e.preventDefault()
        submitCurrentSale(refreshAll)
      }
    } else if ((e.key === '/' && !isTyping) || e.key === 'F3') {
      const searchEl =
        document.querySelector('#pos-search-input') ||
        document.querySelector('#prod-search-input')
      if (searchEl && !document.querySelector('.dialog-backdrop')) {
        e.preventDefault()
        searchEl.focus()
        searchEl.select?.()
      }
    } else if (e.key === 'Escape') {
      if (document.querySelector('.dialog-backdrop')) {
        closeDialog()
      } else if (st.mobileMenuOpen) {
        setState({ mobileMenuOpen: false })
      } else if (st.mobileTicketOpen) {
        setState({ mobileTicketOpen: false })
      }
    }
  })
}
