/**
 * js/ui/settings.js — Panel de Ajustes con Toggles (Interruptores) Interactivos
 * Permite activar/desactivar opciones de la interfaz, reiniciar el Tutorial Paso a Paso
 * y gestionar preferencias operativas del POS.
 */

import {
  getUISettingsSync,
  saveUISettingsSync,
  getTourStateSync,
  saveTourStateSync,
  loadOptional400Catalog,
} from '../core/localStore.js'
import { getTheme, toggleTheme } from '../core/theme.js'
import { navigateTo } from '../core/router.js'
import { setState, showToast } from '../state.js'
import { icon } from './icons.js'

function renderToggleRow({ id, title, desc, checked }) {
  return `
    <div class="settings-toggle-row">
      <div class="settings-toggle-copy">
        <strong class="settings-row-title">${title}</strong>
        <p class="settings-row-desc">${desc}</p>
      </div>
      <button
        type="button"
        id="${id}"
        role="switch"
        aria-checked="${checked ? 'true' : 'false'}"
        class="ui-switch ${checked ? 'switch-on' : 'switch-off'}"
      >
        <span class="ui-switch-thumb"></span>
      </button>
    </div>
  `
}

export function renderSettingsViewHTML() {
  const ui = getUISettingsSync()
  const isDark = getTheme() === 'dark'
  const tour = getTourStateSync()

  return `
    <section class="admin-section">
      <header class="section-header-bar">
        <div>
          <span class="status-tag">Preferencias del Sistema</span>
          <h1 class="page-title">Ajustes e Interruptores de Interfaz</h1>
          <p class="page-subtitle">Activa o desactiva módulos visuales, hardware de cámara y el tutorial interactivo paso a paso.</p>
        </div>
      </header>

      <div class="settings-grid">
        <div class="settings-card">
          <h2 class="subsection-title">Apariencia y Experiencia Visual</h2>
          <div class="settings-list">
            ${renderToggleRow({
              id: 'toggle-dark-mode',
              title: 'Modo Oscuro Premium',
              desc: 'Alterna entre la paleta oscura de alto contraste y el modo claro diurno.',
              checked: isDark,
            })}
            ${renderToggleRow({
              id: 'toggle-show-thumbnails',
              title: 'Mostrar Imágenes de Productos en el POS',
              desc: 'Renderiza las miniaturas dinámicas con fallback automático (onerror) en cada tarjeta.',
              checked: ui.showThumbnails,
            })}
            ${renderToggleRow({
              id: 'toggle-compact-density',
              title: 'Modo Compacto de Alta Densidad',
              desc: 'Optimiza el espaciado de tablas y tarjetas para mostrar más referencias en pantalla.',
              checked: ui.compactDensity,
            })}
          </div>
        </div>

        <div class="settings-card">
          <h2 class="subsection-title">Hardware, Cámara y Onboarding</h2>
          <div class="settings-list">
            ${renderToggleRow({
              id: 'toggle-inline-scanner',
              title: 'Cámara Lectora al 50% de Pantalla (Vista Celular/POS)',
              desc: 'Acopla el lector de códigos de barras ocupando el 50% superior de la pantalla en el POS.',
              checked: ui.inlineMobileScanner,
            })}
            ${renderToggleRow({
              id: 'toggle-scanner-sound',
              title: 'Confirmación Sonora del Escáner (Beep)',
              desc: 'Emite un pulso acústico mediante Web Audio API al registrar un código de barras.',
              checked: ui.scannerSound,
            })}
            ${renderToggleRow({
              id: 'toggle-require-transfer-photo',
              title: 'Exigir Foto en Transferencias (Nequi / Bancolombia)',
              desc: 'Solicita obligatoriamente capturar el comprobante en Canvas (&lt;canvas&gt;) antes de cerrar ventas por transferencia.',
              checked: ui.requireTransferPhoto,
            })}
            ${renderToggleRow({
              id: 'toggle-tour-active',
              title: 'Tutorial Guiado Paso a Paso Activo',
              desc: 'Muestra el asistente interactivo (1. Crear producto → 2. Venta de prueba → 3. Ver descuento de stock).',
              checked: Boolean(tour.active && !tour.completed),
            })}
          </div>

          <div class="settings-actions-footer">
            <button type="button" class="btn btn-outline btn-sm" id="btn-restart-tour">
              ${icon('compass', 15)}
              <span>Reiniciar Tutorial desde el Paso 1</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-seed-optional-400">
              ${icon('products', 15)}
              <span>Importar Catálogo Demo (400 Productos COP)</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  `
}

export function bindSettingsViewEvents(root, refreshAll) {
  root.querySelector('#toggle-dark-mode')?.addEventListener('click', () => {
    toggleTheme()
    setState({})
  })

  root.querySelector('#toggle-show-thumbnails')?.addEventListener('click', () => {
    const cur = getUISettingsSync()
    saveUISettingsSync({ showThumbnails: !cur.showThumbnails })
    setState({})
    showToast('ok', `Miniaturas de productos ${!cur.showThumbnails ? 'activadas' : 'ocultas'}.`)
  })

  root.querySelector('#toggle-compact-density')?.addEventListener('click', () => {
    const cur = getUISettingsSync()
    saveUISettingsSync({ compactDensity: !cur.compactDensity })
    setState({})
    showToast('ok', `Modo compacto ${!cur.compactDensity ? 'activado' : 'desactivado'}.`)
  })

  root.querySelector('#toggle-inline-scanner')?.addEventListener('click', () => {
    const cur = getUISettingsSync()
    saveUISettingsSync({ inlineMobileScanner: !cur.inlineMobileScanner })
    setState({})
    showToast(
      'ok',
      `Lector de cámara al 50% en POS ${!cur.inlineMobileScanner ? 'activado' : 'desactivado'}.`
    )
  })

  root.querySelector('#toggle-scanner-sound')?.addEventListener('click', () => {
    const cur = getUISettingsSync()
    saveUISettingsSync({ scannerSound: !cur.scannerSound })
    setState({})
    showToast('ok', `Sonido de escáner ${!cur.scannerSound ? 'activado' : 'silenciado'}.`)
  })

  root.querySelector('#toggle-require-transfer-photo')?.addEventListener('click', () => {
    const cur = getUISettingsSync()
    saveUISettingsSync({ requireTransferPhoto: !cur.requireTransferPhoto })
    setState({})
    showToast(
      'ok',
      `Foto obligatoria en transferencias ${!cur.requireTransferPhoto ? 'activada' : 'opcional'}.`
    )
  })

  root.querySelector('#toggle-tour-active')?.addEventListener('click', () => {
    const cur = getTourStateSync()
    const isNowActive = !(cur.active && !cur.completed)
    saveTourStateSync({
      active: isNowActive,
      completed: !isNowActive,
      step: isNowActive ? 1 : 4,
    })
    setState({})
    showToast('ok', `Tutorial interactivo ${isNowActive ? 'activado' : 'oculto'}.`)
  })

  root.querySelector('#btn-restart-tour')?.addEventListener('click', () => {
    saveTourStateSync({ active: true, step: 1, completed: false })
    navigateTo('products')
    showToast('ok', 'Tutorial reiniciado en el Paso 1: Crea tu primer producto.')
  })

  root.querySelector('#btn-seed-optional-400')?.addEventListener('click', async () => {
    const btn = root.querySelector('#btn-seed-optional-400')
    if (btn) {
      btn.disabled = true
      btn.textContent = 'Importando 400 productos...'
    }
    try {
      await loadOptional400Catalog()
      if (typeof refreshAll === 'function') await refreshAll()
      showToast('ok', 'Catálogo demo de 400 productos importado en IndexedDB.')
    } catch (err) {
      showToast('error', err.message || 'Error al importar catálogo.')
    }
  })
}
