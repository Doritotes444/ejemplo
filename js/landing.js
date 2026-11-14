/**
 * js/landing.js — Controlador del Entorno Público (Landing Page + Onboarding de Tienda)
 * - Si el usuario ya está registrado o logueado, redirige automáticamente a /app/
 * - Gestiona el flujo de registro del dueño (NIT, Nombre del dueño, Documento, Nombre del local, Dirección y Barrio)
 * - Persiste modo oscuro / claro
 */

import { initTheme, getTheme, toggleTheme } from './core/theme.js'
import {
  getStoredProfileSync,
  getActiveSessionSync,
  registerStoreOnboarding,
} from './core/localStore.js'
import { SEED_PRODUCTS } from './data/db.js'
import { formatCOP } from './utils/money.js'
import { icon } from './ui/icons.js'

function updateThemeButtonIcon() {
  const btn = document.getElementById('lp-theme-toggle')
  if (!btn) return
  const theme = getTheme()
  btn.innerHTML = theme === 'dark' ? icon('sun', 16) : icon('moon', 16)
}

function renderSampleProductsPreview() {
  const grid = document.getElementById('lp-sample-products')
  if (!grid) return

  const picks = [
    SEED_PRODUCTS[0],
    SEED_PRODUCTS[2],
    SEED_PRODUCTS[160],
    SEED_PRODUCTS[172],
    SEED_PRODUCTS[300],
    SEED_PRODUCTS[304],
  ].filter(Boolean)

  grid.innerHTML = picks
    .map(
      (p) => `
      <article class="lp-sample-card">
        <img src="${p.image_url}" alt="${p.name}" loading="lazy" class="lp-sample-img" />
        <div class="lp-sample-body">
          <div class="lp-sample-meta">
            <span class="lp-badge">${p.category_name}</span>
            <span class="mono">${p.sku} · EAN ${p.barcode}</span>
          </div>
          <h4>${p.name}</h4>
          <strong class="lp-sample-price">${formatCOP(p.sale_price)} COP</strong>
        </div>
      </article>
    `
    )
    .join('')
}

function initLandingPage() {
  initTheme()
  updateThemeButtonIcon()

  const params = new URLSearchParams(window.location.search)
  const stayOnLanding = params.get('stay') === '1'

  const existingProfile = getStoredProfileSync()
  const activeSession = getActiveSessionSync()

  // Requisito 1: Si el usuario ya está registrado/logueado, redirigir automáticamente a /app/
  if ((existingProfile || activeSession) && !stayOnLanding) {
    window.location.replace('/app/')
    return
  }

  if (existingProfile) {
    const goAppBtn = document.getElementById('lp-go-app-btn')
    if (goAppBtn) {
      goAppBtn.textContent = `Continuar a ${existingProfile.store_name} (/app)`
    }
  }

  document.getElementById('lp-theme-toggle')?.addEventListener('click', () => {
    toggleTheme()
    updateThemeButtonIcon()
  })

  renderSampleProductsPreview()

  const form = document.getElementById('landing-onboarding-form')
  const errBox = document.getElementById('onb-error')
  const submitBtn = document.getElementById('onb-submit-btn')

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (errBox) errBox.hidden = true

    const store_name = document.getElementById('onb-store-name')?.value.trim()
    const nit = document.getElementById('onb-nit')?.value.trim()
    const owner_name = document.getElementById('onb-owner-name')?.value.trim()
    const owner_document = document.getElementById('onb-owner-doc')?.value.trim()
    const address = document.getElementById('onb-address')?.value.trim()
    const neighborhood = document.getElementById('onb-neighborhood')?.value.trim()

    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = 'Creando tienda y sembrando 400 productos...'
    }

    try {
      await registerStoreOnboarding({
        nit,
        owner_name,
        owner_document,
        store_name,
        address,
        neighborhood,
      })
      window.location.assign('/app/')
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Error al registrar la tienda.'
        errBox.hidden = false
      }
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Registrar Tienda e Ingresar al POS (/app)'
      }
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLandingPage)
} else {
  initLandingPage()
}
