import { isOwner } from '../core/permissions.js'
import { getTheme, toggleTheme } from '../core/theme.js'
import { navigateTo } from '../core/router.js'
import { logoutSession } from '../core/session.js'
import { getState, setState, calculateCartTotals, dismissToast } from '../state.js'
import {
  computeOwnerQuickMetrics,
  getStoredProfileSync,
  getUISettingsSync,
  saveUISettingsSync,
  getStoredNotificationsSync,
  markNotificationReadSync,
  markAllNotificationsReadSync,
  getUnreadNotificationsCountSync,
} from '../core/localStore.js'
import { formatCOP } from '../utils/money.js'
import { BRAND_LOGO_SVG, BRAND_MARK_SVG, icon } from './icons.js'
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
  { id: 'pos', label: 'Punto de Venta', mobileLabel: 'Caja POS', iconName: 'pos' },
  { id: 'products', label: 'Productos', mobileLabel: 'Productos', iconName: 'products' },
  { id: 'lots', label: 'Lotes (FEFO)', mobileLabel: 'Lotes', iconName: 'lots' },
  { id: 'inventory', label: 'Inventario / Kardex', mobileLabel: 'Kardex', iconName: 'inventory' },
  { id: 'sales', label: 'Ventas', mobileLabel: 'Ventas', iconName: 'sales' },
  { id: 'reviews', label: 'Muro de Reseñas', mobileLabel: 'Reseñas', iconName: 'star' },
  { id: 'users', label: 'Usuarios', mobileLabel: 'Usuarios', iconName: 'users' },
  { id: 'settings', label: 'Ajustes', mobileLabel: 'Ajustes', iconName: 'settings' },
]

const TENDERO_NAV_ITEMS = [
  { id: 'pos', label: 'Terminal POS', mobileLabel: 'Caja POS', iconName: 'pos' },
  { id: 'reviews', label: 'Muro de Reseñas', mobileLabel: 'Reseñas', iconName: 'star' },
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

  return `
    <section id="owner-quick-metrics" class="owner-metrics-banner" aria-label="Resumen operativo del día">
      <div class="owner-status-row">
        <div class="owner-stat-item">
          <span class="owner-stat-label">Hoy</span>
          <strong class="owner-stat-val num">${formatCOP(metrics.today_sales_total)}</strong>
          <span class="status-badge badge-neutral">${metrics.today_sales_count} ${metrics.today_sales_count === 1 ? 'venta' : 'ventas'}</span>
        </div>

        <span class="owner-stat-sep hide-on-sm" aria-hidden="true"></span>

        <div class="owner-stat-item hide-on-sm">
          <span class="owner-stat-label">Más vendido</span>
          <strong class="owner-stat-val owner-stat-truncate" title="${escapeHTML(metrics.top_product.name)}">
            ${metrics.top_product.quantity > 0 ? escapeHTML(metrics.top_product.name) : 'Sin ventas hoy'}
          </strong>
        </div>

        <button
          type="button"
          class="owner-stock-alert-btn ${metrics.low_stock_count > 0 ? 'has-alert' : ''}"
          id="btn-kpi-go-lowstock"
        >
          ${metrics.low_stock_count > 0 ? icon('alert', 14) : icon('check', 14)}
          <span>
            ${
              metrics.low_stock_count > 0
                ? `${metrics.low_stock_count} stock bajo${metrics.out_of_stock_count > 0 ? ` (${metrics.out_of_stock_count} agot.)` : ''}`
                : 'Stock al día'
            }
          </span>
          <span class="owner-alert-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  `
}

function formatNotifTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diffSec < 60) return 'Hace un momento'
    if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`
    return d.toLocaleString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return isoStr
  }
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
  const unreadNotifsCount = getUnreadNotificationsCountSync(st.user.role)
  const notificationsList = st.notificationsOpen ? getStoredNotificationsSync(st.user.role) : []
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
          <div class="sidebar-user-block">
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
              title="${theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}"
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
            <a href="#/pos" class="header-brand mobile-only-brand" aria-label="Kairo Inicio">
              ${BRAND_MARK_SVG}
              <span class="mobile-brand-title">${escapeHTML(activeNavMeta.mobileLabel || activeNavMeta.label)}</span>
            </a>
            <div class="desktop-route-crumb">
              ${icon(activeNavMeta.iconName, 16)}
              <span>${escapeHTML(activeNavMeta.label)}</span>
              ${activeRoute === 'pos' ? '<span class="header-shortcuts"><kbd class="kbd-hint">/</kbd><span class="crumb-hint">Buscar</span><kbd class="kbd-hint">F2</kbd><span class="crumb-hint">Cobrar</span></span>' : ''}
            </div>
          </div>

          <div class="header-right">
            <button
              type="button"
              class="btn-icon btn-header-notif ${unreadNotifsCount > 0 ? 'has-unread' : ''}"
              id="btn-header-notifications"
              title="Notificaciones (${unreadNotifsCount} no leídas)"
              aria-label="Abrir panel de notificaciones"
            >
              ${icon('bell', 16)}
              ${unreadNotifsCount > 0 ? `<span class="notif-badge">${unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}</span>` : ''}
            </button>

            <button
              type="button"
              class="btn-icon"
              id="btn-header-theme"
              title="${theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}"
              aria-label="Cambiar tema de color"
            >
              ${theme === 'dark' ? icon('sun', 16) : icon('moon', 16)}
            </button>

            <div class="user-pill mobile-only-user-pill">
              <span class="user-role-dot ${owner ? 'dot-owner' : 'dot-tendero'}"></span>
              <span class="user-role-compact">${escapeHTML(st.user.role_name)}</span>
            </div>

            <button type="button" class="btn-icon mobile-only-logout" id="btn-header-logout" title="Cerrar sesión" aria-label="Cerrar sesión">
              ${icon('logout', 16)}
            </button>
          </div>
        </header>

        ${
          st.notificationsOpen
            ? `
          <div class="notification-drawer-backdrop" id="notification-drawer-backdrop">
            <aside class="notification-drawer" id="notification-drawer" role="dialog" aria-modal="true" aria-label="Historial de notificaciones">
              <div class="notif-drawer-header">
                <div class="notif-drawer-title-row">
                  ${icon('bell', 17)}
                  <h3 class="notif-drawer-title">Notificaciones</h3>
                  ${unreadNotifsCount > 0 ? `<span class="status-badge badge-warning">${unreadNotifsCount} no leídas</span>` : ''}
                </div>
                <div class="notif-drawer-actions">
                  ${
                    unreadNotifsCount > 0
                      ? `
                    <button type="button" class="btn btn-outline btn-xs" id="btn-notif-mark-all-read">
                      Marcar todas leídas
                    </button>
                  `
                      : ''
                  }
                  <button type="button" class="btn-icon" id="btn-close-notif-drawer" aria-label="Cerrar notificaciones">
                    ${icon('close', 16)}
                  </button>
                </div>
              </div>

              <div class="notif-drawer-body">
                ${
                  notificationsList.length === 0
                    ? `
                  <div class="notif-empty-state">
                    <div class="notif-empty-icon">${icon('bell', 24)}</div>
                    <p class="notif-empty-title">Sin notificaciones pendientes</p>
                    <p class="notif-empty-sub">Las alertas de ventas, stock y lotes se registrarán aquí.</p>
                  </div>
                `
                    : notificationsList
                        .map(
                          (n) => `
                      <article class="notif-card notif-${escapeHTML(n.type)} ${n.read ? 'is-read' : 'is-unread'}">
                        <div class="notif-card-lead">
                          <span class="notif-icon notif-icon-${escapeHTML(n.type)}">
                            ${icon(n.type === 'ok' ? 'check' : n.type === 'error' || n.type === 'warning' ? 'alert' : 'info', 14)}
                          </span>
                        </div>
                        <div class="notif-card-main">
                          <div class="notif-card-header">
                            <h4 class="notif-card-title">${escapeHTML(n.title)}</h4>
                            <time class="notif-card-time">${formatNotifTime(n.created_at)}</time>
                          </div>
                          <p class="notif-card-msg">${escapeHTML(n.message)}</p>
                          <div class="notif-card-footer">
                            ${
                              n.action_route && (owner || n.action_route === 'pos')
                                ? `
                              <button type="button" class="btn-link-xs" data-notif-route="${escapeHTML(n.action_route)}">
                                Ir a ${escapeHTML(n.action_route)} →
                              </button>
                            `
                                : ''
                            }
                            ${
                              !n.read
                                ? `
                              <button type="button" class="btn btn-ghost btn-xs" data-notif-mark-read="${escapeHTML(n.id)}">
                                Marcar como leída
                              </button>
                            `
                                : ''
                            }
                          </div>
                        </div>
                      </article>
                    `
                        )
                        .join('')
                }
              </div>
            </aside>
          </div>
        `
            : ''
        }

        ${owner ? renderInteractiveTourHTML(st) : ''}
        ${owner ? renderOwnerQuickMetricsStrip(st) : ''}

        ${
          st.toast
            ? `
          <div class="toast-notification toast-${escapeHTML(st.toast.type)}" role="status" aria-live="polite">
            <span class="toast-icon">${icon(st.toast.type === 'ok' ? 'check' : st.toast.type === 'error' || st.toast.type === 'warning' ? 'alert' : 'info', 14)}</span>
            <span class="toast-msg">${escapeHTML(st.toast.message)}</span>
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

  root.querySelector('#btn-header-notifications')?.addEventListener('click', () => {
    setState({ notificationsOpen: !getState().notificationsOpen })
  })

  root.querySelector('#btn-close-notif-drawer')?.addEventListener('click', () => {
    setState({ notificationsOpen: false })
  })

  root.querySelector('#notification-drawer-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'notification-drawer-backdrop') {
      setState({ notificationsOpen: false })
    }
  })

  root.querySelector('#btn-notif-mark-all-read')?.addEventListener('click', () => {
    const cur = getState()
    markAllNotificationsReadSync(cur.user?.role)
    setState({})
  })

  root.querySelectorAll('[data-notif-mark-read]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-notif-mark-read')
      markNotificationReadSync(id)
      setState({})
    })
  })

  root.querySelectorAll('[data-notif-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetRoute = btn.getAttribute('data-notif-route')
      setState({ notificationsOpen: false })
      navigateTo(targetRoute)
    })
  })

  root.querySelector('#btn-close-toast')?.addEventListener('click', () => {
    dismissToast()
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
