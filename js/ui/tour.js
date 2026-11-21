/**
 * js/ui/tour.js — Ventanas Amplias y Accesibles para el Tutorial Interactivo
 * - Paso 1: Crear primer producto comercial
 * - Paso 2: Registrar una venta de prueba en caja
 * - Paso 3: Verificar el Kardex y descuento de existencias
 * - Aislamiento estricto de eventos para evitar toques involuntarios sobre el POS.
 */

import { getTourStateSync, saveTourStateSync, syncTourProgress } from '../core/localStore.js'
import { navigateTo } from '../core/router.js'
import { getState, setState, addProductToCart, showToast } from '../state.js'
import { isOwner } from '../core/permissions.js'
import { openProductFormModal } from './lots.js'
import { icon } from './icons.js'

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderInteractiveTourHTML(st) {
  if (!isOwner(st.user)) return ''

  const productsCount = (st.products || []).length
  const salesCount = (st.sales || []).length
  const tour = syncTourProgress(productsCount, salesCount)

  if (!tour.active || tour.completed) return ''

  const step = Math.min(Math.max(1, tour.step || 1), 3)

  const stepsMeta = [
    {
      num: 1,
      badge: 'Paso 1 de 3',
      title: 'Crea tu primer producto comercial',
      summary: 'Tu tienda inicia 100% en blanco para operar con datos comerciales reales.',
      explanation:
        'Para comenzar a vender y controlar inventario, registra tu primer artículo con un precio de venta y su lote inicial. Solo necesitas completar el nombre y el precio; los detalles de código EAN, imagen o costos son opcionales.',
      actionText: 'Crear primer producto',
      actionId: 'btn-tour-step1',
      actionIcon: 'plus',
      done: productsCount >= 1,
    },
    {
      num: 2,
      badge: 'Paso 2 de 3',
      title: 'Registra una venta de prueba en caja',
      summary: 'Comprueba la rapidez del Punto de Venta y la salida automática de mercancía.',
      explanation:
        'Agrega tu producto recién creado a la orden de venta y completa el cobro en efectivo o transferencia. El sistema asignará automáticamente la salida por el lote más próximo a vencer (FEFO) o más antiguo (FIFO).',
      actionText: 'Agregar producto al ticket',
      actionId: 'btn-tour-step2',
      actionIcon: 'pos',
      done: salesCount >= 1,
    },
    {
      num: 3,
      badge: 'Paso 3 de 3',
      title: 'Verifica el Kardex y existencias',
      summary: 'Controla en tiempo real la trazabilidad de cada movimiento de inventario.',
      explanation:
        'Inspecciona cómo el sistema descontó automáticamente las existencias del lote correspondiente y dejó registrado el saldo actual, el folio de la venta y el usuario responsable en la bitácora del Kardex.',
      actionText: st.route === 'inventory' ? 'Finalizar tutorial' : 'Ir a Inventario / Kardex',
      actionId: st.route === 'inventory' ? 'btn-tour-finish' : 'btn-tour-go-kardex',
      actionIcon: st.route === 'inventory' ? 'check' : 'inventory',
      done: productsCount >= 1 && salesCount >= 1 && st.route === 'inventory',
    },
  ]

  const currentMeta = stepsMeta[step - 1]

  return `
    <div class="tour-modal-backdrop" id="tour-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-dialog-title">
      <div class="tour-dialog-panel" id="tour-dialog-panel">
        <header class="tour-dialog-header">
          <div class="tour-header-lead">
            <span class="status-badge badge-accent tour-step-pill">
              ${icon('compass', 14)}
              <span>${currentMeta.badge}</span>
            </span>
            <div class="tour-stepper-dots" aria-hidden="true">
              <span class="stepper-dot ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}"></span>
              <span class="stepper-dot ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}"></span>
              <span class="stepper-dot ${step === 3 ? 'active' : ''}"></span>
            </div>
          </div>
          <button type="button" class="btn-icon btn-icon-subtle" id="btn-tour-dismiss" title="Ocultar tutorial" aria-label="Cerrar tutorial">
            ${icon('close', 16)}
          </button>
        </header>

        <div class="tour-dialog-body">
          <h2 class="tour-dialog-title" id="tour-dialog-title">${escapeHTML(currentMeta.title)}</h2>
          <p class="tour-dialog-summary">${escapeHTML(currentMeta.summary)}</p>
          <div class="tour-dialog-box">
            <p class="tour-dialog-explanation">${escapeHTML(currentMeta.explanation)}</p>
          </div>
        </div>

        <footer class="tour-dialog-footer">
          <div class="tour-nav-buttons">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              id="btn-tour-prev"
              ${step === 1 ? 'disabled' : ''}
              aria-label="Paso anterior del tutorial"
            >
              ← Atrás
            </button>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              id="btn-tour-next"
              ${step === 3 ? 'disabled' : ''}
              aria-label="Siguiente paso del tutorial"
            >
              Siguiente →
            </button>
          </div>

          <div class="tour-action-primary">
            <button type="button" class="btn btn-primary btn-sm" id="${currentMeta.actionId}">
              ${icon(currentMeta.actionIcon, 15)}
              <span>${currentMeta.actionText}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  `
}

export function bindInteractiveTourEvents(root, refreshAll) {
  const backdrop = root.querySelector('#tour-modal-backdrop')
  const panel = root.querySelector('#tour-dialog-panel')

  if (!backdrop) return

  // Aislamiento estricto de eventos táctiles y de clic para evitar mutaciones en el POS
  const isolateEvent = (e) => {
    e.stopPropagation()
  }
  backdrop.addEventListener('click', isolateEvent)
  backdrop.addEventListener('touchstart', isolateEvent, { passive: true })
  backdrop.addEventListener('touchend', isolateEvent)
  panel?.addEventListener('click', isolateEvent)
  panel?.addEventListener('touchstart', isolateEvent, { passive: true })
  panel?.addEventListener('touchend', isolateEvent)

  root.querySelector('#btn-tour-dismiss')?.addEventListener('click', (e) => {
    e.stopPropagation()
    saveTourStateSync({ active: false })
    setState({})
    showToast('ok', 'Tutorial ocultado. Puedes reactivarlo en cualquier momento desde Ajustes.')
  })

  root.querySelector('#btn-tour-prev')?.addEventListener('click', (e) => {
    e.stopPropagation()
    const cur = getTourStateSync()
    if (cur.step > 1) {
      saveTourStateSync({ step: cur.step - 1 })
      setState({})
    }
  })

  root.querySelector('#btn-tour-next')?.addEventListener('click', (e) => {
    e.stopPropagation()
    const cur = getTourStateSync()
    if (cur.step < 3) {
      saveTourStateSync({ step: cur.step + 1 })
      setState({})
    }
  })

  root.querySelector('#btn-tour-step1')?.addEventListener('click', (e) => {
    e.stopPropagation()
    saveTourStateSync({ active: false }) // Cierra modal temporalmente para trabajar en el formulario
    navigateTo('products')
    openProductFormModal(null, () => {
      saveTourStateSync({ active: true, step: 2 })
      if (typeof refreshAll === 'function') refreshAll()
    })
  })

  root.querySelector('#btn-tour-step2')?.addEventListener('click', (e) => {
    e.stopPropagation()
    const st = getState()
    navigateTo('pos')
    const firstProd = (st.products || []).find((p) => p.is_active && p.available_stock > 0)
    if (firstProd && st.cart.length === 0) {
      const res = addProductToCart(st.cart, firstProd, 1)
      if (res.ok) {
        saveTourStateSync({ active: false, step: 2 }) // Deja ver la caja
        setState({ cart: res.cart })
        showToast(
          'ok',
          `Producto "${firstProd.name}" agregado. Pulsa "Cobrar Ahora" para registrar la venta.`
        )
      }
    } else {
      saveTourStateSync({ active: false, step: 2 })
      setState({})
      showToast('info', 'Agrega un producto al ticket y pulsa "Cobrar Ahora".')
    }
  })

  root.querySelector('#btn-tour-go-kardex')?.addEventListener('click', (e) => {
    e.stopPropagation()
    navigateTo('inventory')
  })

  root.querySelector('#btn-tour-finish')?.addEventListener('click', (e) => {
    e.stopPropagation()
    saveTourStateSync({ active: false, step: 3, completed: true })
    showToast('ok', '¡Excelente! Has completado el tutorial de inicio comercial de Kairo.')
    setState({})
  })
}
