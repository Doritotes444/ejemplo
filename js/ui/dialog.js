import { icon } from './icons.js'

/**
 * Gestor de Diálogos Modales Sobrios y Accesibles.
 */

let currentModal = null

export function closeDialog() {
  if (currentModal) {
    currentModal.remove()
    currentModal = null
  }
}

export function openDialog({ title, subtitle = '', bodyHTML = '', maxWidth = '540px', onMount }) {
  closeDialog()

  const backdrop = document.createElement('div')
  backdrop.className = 'dialog-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')

  backdrop.innerHTML = `
    <div class="dialog-panel" style="max-width: ${maxWidth}">
      <header class="dialog-header">
        <div>
          <h3 class="dialog-title">${title}</h3>
          ${subtitle ? `<p class="dialog-subtitle">${subtitle}</p>` : ''}
        </div>
        <button type="button" class="btn-icon" data-dialog-close aria-label="Cerrar ventana">
          ${icon('close', 16)}
        </button>
      </header>
      <div class="dialog-body">
        ${bodyHTML}
      </div>
    </div>
  `

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-dialog-close]')) {
      closeDialog()
    }
  })

  document.body.appendChild(backdrop)
  currentModal = backdrop

  if (typeof onMount === 'function') {
    onMount(backdrop, closeDialog)
  }

  return backdrop
}
