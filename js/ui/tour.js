/**
 * js/ui/tour.js — Sistema de Tutorial Interactivo Paso a Paso (Estilo Intro.js en Vanilla JS)
 * Obliga y guía al dueño recién registrado (con tienda en blanco) a través de 3 hitos verificables:
 * Paso 1: Crear su primer producto real.
 * Paso 2: Hacer una venta de prueba en el POS.
 * Paso 3: Verificar cómo se descontó el stock en el Inventario / Kardex.
 */

import { getTourStateSync, saveTourStateSync, syncTourProgress } from '../core/localStore.js'
import { navigateTo } from '../core/router.js'
import { getState, setState, addProductToCart, showToast } from '../state.js'
import { isOwner } from '../core/permissions.js'
import { openProductFormModal } from './lots.js'
import { icon } from './icons.js'

export function renderInteractiveTourHTML(st) {
  if (!isOwner(st.user)) return ''

  const productsCount = (st.products || []).length
  const salesCount = (st.sales || []).length
  const tour = syncTourProgress(productsCount, salesCount)

  if (!tour.active || tour.completed) return ''

  const step = tour.step || 1

  const stepsMeta = [
    {
      num: 1,
      title: '1. Crea tu primer producto',
      desc: 'Tu tienda inicia 100% en blanco (sin datos falsos). Registra tu primer producto con un lote inicial para habilitar el Punto de Venta.',
      done: productsCount >= 1,
    },
    {
      num: 2,
      title: '2. Haz una venta de prueba',
      desc: 'Agrega tu producto recién creado al ticket del POS y confirma la transacción para activar el motor FEFO/FIFO.',
      done: salesCount >= 1,
    },
    {
      num: 3,
      title: '3. Verifica el descuento de stock',
      desc: 'Inspecciona en tiempo real cómo el Kardex descontó automáticamente las unidades vendidas del lote activo.',
      done: productsCount >= 1 && salesCount >= 1 && st.route === 'inventory',
    },
  ]

  const currentMeta = stepsMeta[step - 1] || stepsMeta[0]

  let actionBtnHTML = ''
  if (step === 1) {
    actionBtnHTML = `
      <button type="button" class="btn btn-primary btn-sm tour-pulse-btn" id="btn-tour-step1">
        ${icon('plus', 15)}
        <span>Crear Mi Primer Producto</span>
      </button>
    `
  } else if (step === 2) {
    actionBtnHTML = `
      <button type="button" class="btn btn-primary btn-sm tour-pulse-btn" id="btn-tour-step2">
        ${icon('pos', 15)}
        <span>Probar Venta en POS</span>
      </button>
    `
  } else if (step === 3) {
    actionBtnHTML = `
      <div class="tour-step3-actions">
        ${
          st.route !== 'inventory'
            ? `
          <button type="button" class="btn btn-outline btn-sm" id="btn-tour-go-kardex">
            ${icon('inventory', 15)}
            <span>Inspeccionar Kardex</span>
          </button>
        `
            : ''
        }
        <button type="button" class="btn btn-primary btn-sm tour-pulse-btn" id="btn-tour-finish">
          ${icon('check', 15)}
          <span>Finalizar Tutorial</span>
        </button>
      </div>
    `
  }

  return `
    <aside id="onboarding-tour-bar" class="onboarding-tour-banner" aria-label="Tutorial interactivo paso a paso">
      <div class="tour-banner-left">
        <div class="tour-badge-pill">
          ${icon('compass', 14)}
          <span>Tutorial Guiado · Paso ${step} de 3</span>
        </div>
        <div class="tour-copy">
          <strong>${currentMeta.title}</strong>
          <p>${currentMeta.desc}</p>
        </div>
      </div>

      <div class="tour-stepper-track">
        ${stepsMeta
          .map(
            (s) => `
            <div class="tour-step-chip ${s.done ? 'step-done' : step === s.num ? 'step-current' : 'step-locked'}">
              <span class="step-dot">${s.done ? '✓' : s.num}</span>
              <span>Paso ${s.num}</span>
            </div>
          `
          )
          .join('')}
      </div>

      <div class="tour-banner-actions">
        ${actionBtnHTML}
      </div>
    </aside>
  `
}

export function bindInteractiveTourEvents(root, refreshAll) {
  root.querySelector('#btn-tour-step1')?.addEventListener('click', () => {
    navigateTo('products')
    openProductFormModal(null, refreshAll)
  })

  root.querySelector('#btn-tour-step2')?.addEventListener('click', () => {
    const st = getState()
    navigateTo('pos')
    const firstProd = (st.products || []).find((p) => p.is_active && p.available_stock > 0)
    if (firstProd && st.cart.length === 0) {
      const res = addProductToCart(st.cart, firstProd, 1)
      if (res.ok) {
        setState({ cart: res.cart })
        showToast(
          'ok',
          `Tutorial Paso 2: "${firstProd.name}" agregado al ticket. Ahora pulsa "Confirmar Venta".`
        )
      }
    }
  })

  root.querySelector('#btn-tour-go-kardex')?.addEventListener('click', () => {
    navigateTo('inventory')
  })

  root.querySelector('#btn-tour-finish')?.addEventListener('click', () => {
    const st = getState()
    if (st.route !== 'inventory') {
      navigateTo('inventory')
    }
    saveTourStateSync({ active: false, step: 4, completed: true })
    showToast(
      'ok',
      '¡Felicidades! Completaste el tutorial: creaste tu producto, registraste una venta y verificaste el descuento de stock.'
    )
    setState({})
  })
}
