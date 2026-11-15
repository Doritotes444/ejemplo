/**
 * js/landing.js — Landing Page Ultra-Minimalista y Motor 3D de Nodos/Partículas Conectadas
 * - Efecto 3D en <canvas> con proyección de perspectiva (x, y, z) y reacción al mouse (estilo Vercel/Antigravity)
 * - Optimización automática con menos partículas en móvil para garantizar 60fps
 * - CTAs: "¿Nuevo usuario? Registrarse", "¿Ya tienes cuenta? Iniciar Sesión", "Dudas e Inquietudes"
 * - Onboarding de tienda en blanco (cero datos falsos obligatorios)
 */

import { initTheme, getTheme, toggleTheme } from './core/theme.js'
import {
  getStoredProfileSync,
  getActiveSessionSync,
  registerStoreOnboarding,
  authenticateLocalUser,
} from './core/localStore.js'
import { icon } from './ui/icons.js'

function updateThemeButtonIcon() {
  const btn = document.getElementById('lp-theme-toggle')
  if (!btn) return
  const theme = getTheme()
  btn.innerHTML = theme === 'dark' ? icon('sun', 16) : icon('moon', 16)
}

/**
 * Motor 3D de Nodos / Partículas Conectadas en <canvas>
 * Con fallback de rendimiento en pantallas móviles (menos nodos y menor radio de enlace).
 */
function init3DParticleNetwork() {
  const canvas = document.getElementById('particle-network-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let width = (canvas.width = window.innerWidth)
  let height = (canvas.height = window.innerHeight)

  const isMobile = () => window.innerWidth <= 768
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const FOV = 360
  const MAX_DEPTH = 420
  let nodes = []

  const mouse = {
    x: width / 2,
    y: height / 2,
    active: false,
    targetTiltX: 0,
    targetTiltY: 0,
    tiltX: 0,
    tiltY: 0,
  }

  function createNodes() {
    width = canvas.width = window.innerWidth
    height = canvas.height = window.innerHeight
    // Optimización móvil: 20 partículas en celular vs 72 en escritorio
    const count = prefersReducedMotion ? 14 : isMobile() ? 20 : 72
    nodes = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * width * 1.35,
      y: (Math.random() - 0.5) * height * 1.35,
      z: Math.random() * MAX_DEPTH,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      vz: (Math.random() - 0.5) * 0.65,
      baseRadius: Math.random() * 1.6 + 1.1,
    }))
  }

  createNodes()

  window.addEventListener('resize', createNodes, { passive: true })

  window.addEventListener(
    'mousemove',
    (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
      mouse.targetTiltX = ((e.clientX - width / 2) / width) * 95
      mouse.targetTiltY = ((e.clientY - height / 2) / height) * 95
    },
    { passive: true }
  )

  window.addEventListener(
    'mouseleave',
    () => {
      mouse.active = false
      mouse.targetTiltX = 0
      mouse.targetTiltY = 0
    },
    { passive: true }
  )

  function renderFrame() {
    if (document.hidden) {
      requestAnimationFrame(renderFrame)
      return
    }

    ctx.clearRect(0, 0, width, height)

    const isDark = getTheme() === 'dark'
    const rgbNode = isDark ? '96, 165, 250' : '37, 99, 235'
    const rgbLine = isDark ? '59, 130, 246' : '37, 99, 235'

    mouse.tiltX += (mouse.targetTiltX - mouse.tiltX) * 0.06
    mouse.tiltY += (mouse.targetTiltY - mouse.tiltY) * 0.06

    const cx = width / 2
    const cy = height / 2
    const maxDist = isMobile() ? 115 : 165

    const projected = []

    for (const n of nodes) {
      n.x += n.vx
      n.y += n.vy
      n.z += n.vz

      if (n.z <= 10) n.z = MAX_DEPTH
      if (n.z > MAX_DEPTH) n.z = 10

      const boundX = width * 0.72
      const boundY = height * 0.72
      if (n.x < -boundX || n.x > boundX) n.vx *= -1
      if (n.y < -boundY || n.y > boundY) n.vy *= -1

      const scale = FOV / (FOV + n.z)
      let px = cx + (n.x + mouse.tiltX) * scale
      let py = cy + (n.y + mouse.tiltY) * scale

      // Reacción magnética suave al puntero del mouse
      if (mouse.active) {
        const dxM = px - mouse.x
        const dyM = py - mouse.y
        const distM = Math.hypot(dxM, dyM)
        if (distM < 150 && distM > 1) {
          const force = (150 - distM) / 150
          px += (dxM / distM) * force * 18
          py += (dyM / distM) * force * 18
        }
      }

      const alpha = Math.min(0.85, Math.max(0.15, (1 - n.z / MAX_DEPTH) * 0.85))
      projected.push({
        px,
        py,
        r: n.baseRadius * scale * 1.25,
        alpha,
      })
    }

    // Dibujar conexiones 3D entre nodos cercanos
    ctx.lineWidth = 1
    for (let i = 0; i < projected.length; i++) {
      const a = projected[i]
      for (let j = i + 1; j < projected.length; j++) {
        const b = projected[j]
        const dx = a.px - b.px
        const dy = a.py - b.py
        const dist = Math.hypot(dx, dy)
        if (dist < maxDist) {
          const lineAlpha = (1 - dist / maxDist) * Math.min(a.alpha, b.alpha) * 0.48
          ctx.strokeStyle = `rgba(${rgbLine}, ${lineAlpha.toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(a.px, a.py)
          ctx.lineTo(b.px, b.py)
          ctx.stroke()
        }
      }

      // Conectar nodos cercanos directamente al cursor del mouse
      if (mouse.active && !isMobile()) {
        const dMouse = Math.hypot(a.px - mouse.x, a.py - mouse.y)
        if (dMouse < 175) {
          const mAlpha = (1 - dMouse / 175) * 0.42
          ctx.strokeStyle = `rgba(${rgbNode}, ${mAlpha.toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(a.px, a.py)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.stroke()
        }
      }
    }

    // Dibujar nodos con brillo sutil
    for (const p of projected) {
      ctx.fillStyle = `rgba(${rgbNode}, ${p.alpha.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2)
      ctx.fill()
    }

    requestAnimationFrame(renderFrame)
  }

  requestAnimationFrame(renderFrame)
}

function openLandingModal(modalId) {
  document.querySelectorAll('.lp-modal-backdrop').forEach((m) => {
    m.hidden = m.id !== modalId
  })
  const firstInput = document.querySelector(`#${modalId} input`)
  if (firstInput) setTimeout(() => firstInput.focus(), 40)
}

function closeAllLandingModals() {
  document.querySelectorAll('.lp-modal-backdrop').forEach((m) => {
    m.hidden = true
  })
}

function initLandingPage() {
  initTheme()
  updateThemeButtonIcon()
  init3DParticleNetwork()

  const params = new URLSearchParams(window.location.search)
  const stayOnLanding = params.get('stay') === '1'

  const existingProfile = getStoredProfileSync()
  const activeSession = getActiveSessionSync()

  const targetAppUrl = new URL('./app/', window.location.href).href
  if ((existingProfile || activeSession) && !stayOnLanding) {
    window.location.replace(targetAppUrl)
    return
  }

  document.getElementById('lp-theme-toggle')?.addEventListener('click', () => {
    toggleTheme()
    updateThemeButtonIcon()
  })

  // Botones Principales (Call to Actions)
  document.getElementById('btn-cta-register')?.addEventListener('click', () => {
    openLandingModal('modal-register')
  })

  document.getElementById('btn-cta-login')?.addEventListener('click', () => {
    if (getStoredProfileSync()) {
      openLandingModal('modal-login')
    } else {
      window.location.assign(new URL('./app/?mode=login', window.location.href).href)
    }
  })

  document.getElementById('btn-cta-faq')?.addEventListener('click', () => {
    openLandingModal('modal-faq')
  })

  document.getElementById('btn-faq-to-register')?.addEventListener('click', () => {
    openLandingModal('modal-register')
  })

  document.querySelectorAll('[data-close-lp-modal]').forEach((btn) => {
    btn.addEventListener('click', closeAllLandingModals)
  })

  document.querySelectorAll('.lp-modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllLandingModals()
    })
  })

  // Formulario de Registro (Crea tienda EN BLANCO e inicia Tutorial Paso a Paso)
  const regForm = document.getElementById('landing-onboarding-form')
  const regError = document.getElementById('onb-error')
  const regSubmit = document.getElementById('onb-submit-btn')

  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (regError) regError.hidden = true

    const store_name = document.getElementById('onb-store-name')?.value.trim()
    const nit = document.getElementById('onb-nit')?.value.trim()
    const owner_name = document.getElementById('onb-owner-name')?.value.trim()
    const owner_document = document.getElementById('onb-owner-doc')?.value.trim()
    const address = document.getElementById('onb-address')?.value.trim()
    const neighborhood = document.getElementById('onb-neighborhood')?.value.trim()

    if (regSubmit) {
      regSubmit.disabled = true
      regSubmit.textContent = 'Configurando tienda en blanco...'
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
      window.location.assign(new URL('./app/#/products', window.location.href).href)
    } catch (err) {
      if (regError) {
        regError.textContent = err.message || 'Error al registrar la tienda.'
        regError.hidden = false
      }
      if (regSubmit) {
        regSubmit.disabled = false
        regSubmit.textContent = 'Crear Tienda en Blanco e Iniciar Tutorial'
      }
    }
  })

  // Formulario de Inicio de Sesión Rápido
  const loginForm = document.getElementById('landing-login-form')
  const loginErr = document.getElementById('lp-login-error')

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (loginErr) loginErr.hidden = true
    const username = document.getElementById('lp-login-user')?.value.trim()
    const password = document.getElementById('lp-login-pass')?.value || ''

    try {
      await authenticateLocalUser(username, password)
      window.location.assign(new URL('./app/', window.location.href).href)
    } catch (err) {
      if (loginErr) {
        loginErr.textContent = err.message || 'Credenciales inválidas.'
        loginErr.hidden = false
      }
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLandingPage)
} else {
  initLandingPage()
}
