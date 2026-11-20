import { icon } from './icons.js'

/**
 * Gestor de Diálogos Modales Sobrios y Accesibles.
 */

let currentModal = null
let currentOnClose = null
let previouslyFocusedEl = null

export function closeDialog() {
  if (currentOnClose) {
    try {
      currentOnClose()
    } catch {
      // ignore cleanup errors
    }
    currentOnClose = null
  }
  if (currentModal) {
    currentModal.remove()
    currentModal = null
  }
  if (previouslyFocusedEl && typeof previouslyFocusedEl.focus === 'function') {
    try {
      if (document.contains(previouslyFocusedEl)) {
        previouslyFocusedEl.focus()
      }
    } catch {
      // ignore focus restore errors
    }
  }
  previouslyFocusedEl = null
}

export function openDialog({
  title,
  subtitle = '',
  bodyHTML = '',
  maxWidth = '540px',
  onMount,
  onClose,
}) {
  closeDialog()
  previouslyFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null
  currentOnClose = typeof onClose === 'function' ? onClose : null

  const titleId = `dialog-title-${Date.now()}`
  const backdrop = document.createElement('div')
  backdrop.className = 'dialog-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  backdrop.setAttribute('aria-labelledby', titleId)

  backdrop.innerHTML = `
    <div class="dialog-panel" style="max-width: ${maxWidth}">
      <header class="dialog-header">
        <div>
          <h3 class="dialog-title" id="${titleId}">${title}</h3>
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

  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusables = Array.from(
        backdrop.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  })

  document.body.appendChild(backdrop)
  currentModal = backdrop

  if (typeof onMount === 'function') {
    onMount(backdrop, closeDialog)
  }

  const autofocusEl = backdrop.querySelector('[autofocus]')
  if (autofocusEl && typeof autofocusEl.focus === 'function') {
    setTimeout(() => autofocusEl.focus(), 10)
  }

  return backdrop
}
