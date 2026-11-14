import { ROLES, isOwner } from '../core/permissions.js'
import { getTheme, setTheme } from '../core/theme.js'
import { getState, setState } from '../state.js'
import { requestRoleSwitch } from './login.js'
import { renderPOSSectionHTML, bindPOSEvents, executeCheckout } from './pos.js'
import { renderOwnerSectionHTML, bindOwnerSectionEvents } from './lots.js'

/**
 * Shell Principal de la SPA (Una sola pantalla integrada).
 * - Barra superior con nombre del negocio, conmutador de rol ('Tendero' vs 'Dueño') y selector de Tema (Sistema / Claro / Oscuro).
 * - Área POS siempre disponible (conservando el carrito al cambiar de rol o abrir modales).
 * - Panel completo de Dueño integrado en la misma pantalla cuando el rol activo es 'Dueño'.
 */

export function renderAppShell(rootElement, refreshAllData) {
  if (!rootElement) return
  const state = getState()
  const ownerMode = isOwner(state.user)
  const themeInfo = getTheme()

  rootElement.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-block">
          <div class="brand-logo" aria-hidden="true">T</div>
          <div>
            <h1 class="brand-title">${state.user.tienda_nombre}</h1>
            <p class="brand-subtitle">
              POS Minimalista · Inventario por Lotes FIFO
            </p>
          </div>
        </div>

        <div class="topbar-controls">
          <!-- Selector de Rol en la misma pantalla -->
          <div class="role-switcher" role="group" aria-label="Rol activo">
            <button
              type="button"
              class="role-btn ${!ownerMode ? 'active-tendero' : ''}"
              data-switch-role="${ROLES.TENDERO}"
              title="Interfaz bloqueada: solo vender y descontar stock"
            >
              🛒 Tendero
            </button>
            <button
              type="button"
              class="role-btn ${ownerMode ? 'active-owner' : ''}"
              data-switch-role="${ROLES.ADMIN}"
              title="Panel completo: productos, lotes FIFO, costos y anulaciones"
            >
              🔑 Dueño
            </button>
          </div>

          <!-- Persistencia de Modo Oscuro / Claro / Sistema -->
          <div class="theme-switcher" role="group" aria-label="Tema de color">
            <button
              type="button"
              class="theme-btn ${themeInfo.preference === 'light' ? 'active' : ''}"
              data-set-theme="light"
              title="Modo Claro"
            >
              ☀️ Claro
            </button>
            <button
              type="button"
              class="theme-btn ${themeInfo.preference === 'dark' ? 'active' : ''}"
              data-set-theme="dark"
              title="Modo Oscuro"
            >
              🌙 Oscuro
            </button>
            <button
              type="button"
              class="theme-btn ${themeInfo.preference === 'sistema' ? 'active' : ''}"
              data-set-theme="sistema"
              title="Seguir preferencia del sistema"
            >
              💻 Auto
            </button>
          </div>
        </div>
      </header>

      ${
        state.feedback
          ? `
        <div class="feedback-banner feedback-${state.feedback.type}" role="status">
          <span>${state.feedback.text}</span>
          <button type="button" class="feedback-close" id="btn-close-feedback" aria-label="Cerrar aviso">✕</button>
        </div>
      `
          : ''
      }

      <main class="main-content">
        ${renderPOSSectionHTML(state)}
        ${renderOwnerSectionHTML(state)}
      </main>
    </div>
  `

  // Eventos de barra superior
  rootElement.querySelectorAll('[data-switch-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetRole = btn.getAttribute('data-switch-role')
      requestRoleSwitch(targetRole, () => refreshAllData())
    })
  })

  rootElement.querySelectorAll('[data-set-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pref = btn.getAttribute('data-set-theme')
      setTheme(pref)
      renderAppShell(rootElement, refreshAllData)
    })
  })

  rootElement.querySelector('#btn-close-feedback')?.addEventListener('click', () => {
    setState({ feedback: null })
  })

  bindPOSEvents(rootElement, refreshAllData)
  bindOwnerSectionEvents(rootElement, refreshAllData)
}

export function bindGlobalShortcuts(refreshAllData) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault()
      const st = getState()
      if (st.cart.length > 0) {
        executeCheckout(refreshAllData)
      }
    } else if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-backdrop')
      if (openModal) {
        openModal.remove()
      }
    }
  })
}
