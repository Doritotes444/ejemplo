/**
 * Sistema de Modales Limpios (Dialog nativo / Overlay accesible en Vanilla JS).
 * Permite abrir formularios de productos, lotes FIFO, confirmación de PIN o auditoría
 * sobre la misma pantalla sin perder el estado ni el carrito.
 */

let activeModalRoot = null

export function closeDialog() {
  if (activeModalRoot) {
    activeModalRoot.remove()
    activeModalRoot = null
  }
}

export function openDialog({ title, subtitle = '', contentHTML = '', width = '560px', onMount }) {
  closeDialog()

  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')

  backdrop.innerHTML = `
    <div class="modal-card" style="max-width: ${width}">
      <header class="modal-header">
        <div>
          <h3 class="modal-title">${title}</h3>
          ${subtitle ? `<p class="modal-subtitle">${subtitle}</p>` : ''}
        </div>
        <button type="button" class="btn-icon modal-close-btn" aria-label="Cerrar ventana" data-close-modal>
          ✕
        </button>
      </header>
      <div class="modal-body">
        ${contentHTML}
      </div>
    </div>
  `

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close-modal]')) {
      closeDialog()
    }
  })

  document.body.appendChild(backdrop)
  activeModalRoot = backdrop

  if (typeof onMount === 'function') {
    onMount(backdrop, closeDialog)
  }

  return backdrop
}
