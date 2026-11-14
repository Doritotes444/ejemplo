import { getState, setState } from '../state.js'
import { loginWithCredentials, setupOwnerAccount } from '../core/session.js'
import { getTheme, toggleTheme } from '../core/theme.js'
import { BRAND_LOGO_SVG, icon } from './icons.js'

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Renderiza la vista de Onboarding (Creación de Tienda) o Inicio de Sesión dentro de /app.
 */
export function renderAuthScreen(container, onAuthenticated) {
  const st = getState()
  const isSetup = !st.initialized
  const currentTheme = getTheme()
  const store = st.storeProfile

  container.innerHTML = `
    <div class="auth-layout">
      <header class="auth-topbar">
        <a href="/" class="brand-lockup" title="Ir a la página pública">
          ${BRAND_LOGO_SVG}
        </a>
        <div class="header-right">
          <a href="/?stay=1" class="btn btn-ghost btn-sm">Ver Landing Pública</a>
          <button
            type="button"
            id="auth-theme-toggle"
            class="btn-icon"
            aria-label="Alternar tema visual"
            title="Cambiar modo claro / oscuro"
          >
            ${currentTheme === 'dark' ? icon('sun', 16) : icon('moon', 16)}
          </button>
        </div>
      </header>

      <main class="auth-main">
        <section class="auth-card ${isSetup ? 'auth-card-wide' : ''}" aria-labelledby="auth-heading">
          <div class="auth-card-header">
            <span class="status-tag">${isSetup ? 'Onboarding · Registro de Establecimiento' : escapeHTML(store?.store_name || 'Acceso al Sistema')}</span>
            <h1 id="auth-heading">${isSetup ? 'Registrar Nueva Tienda' : 'Iniciar Sesión Operativa'}</h1>
            <p class="auth-description">
              ${
                isSetup
                  ? 'Ingresa la información legal y de ubicación del comercio. Se cargarán automáticamente 400 productos reales (Abarrotes, Víveres y Papelería) en IndexedDB.'
                  : `${escapeHTML(store?.address || '')} · Barrio ${escapeHTML(store?.neighborhood || '')} · NIT ${escapeHTML(store?.nit || '')}`
              }
            </p>
          </div>

          ${
            isSetup
              ? `
              <form id="setup-form" class="form-stack" autocomplete="off">
                <div class="form-row-2">
                  <div class="form-field">
                    <label for="setup-store-name">Nombre del local *</label>
                    <input
                      id="setup-store-name"
                      name="store_name"
                      type="text"
                      required
                      minlength="2"
                      placeholder="Ej. Autoservicio y Papelería El Vecino"
                      autofocus
                    />
                  </div>
                  <div class="form-field">
                    <label for="setup-nit">NIT del establecimiento *</label>
                    <input
                      id="setup-nit"
                      name="nit"
                      type="text"
                      required
                      minlength="5"
                      placeholder="Ej. 901.482.310-4"
                    />
                  </div>
                </div>

                <div class="form-row-2">
                  <div class="form-field">
                    <label for="setup-fullname">Nombre del dueño *</label>
                    <input
                      id="setup-fullname"
                      name="full_name"
                      type="text"
                      required
                      minlength="2"
                      placeholder="Ej. Carlos Mendoza"
                    />
                  </div>
                  <div class="form-field">
                    <label for="setup-doc">Documento de identidad (C.C.) *</label>
                    <input
                      id="setup-doc"
                      name="owner_document"
                      type="text"
                      required
                      minlength="5"
                      placeholder="Ej. 1020784512"
                    />
                  </div>
                </div>

                <div class="form-row-2">
                  <div class="form-field">
                    <label for="setup-address">Dirección del local *</label>
                    <input
                      id="setup-address"
                      name="address"
                      type="text"
                      required
                      minlength="4"
                      placeholder="Ej. Calle 45 # 18-22 Local 1"
                    />
                  </div>
                  <div class="form-field">
                    <label for="setup-neighborhood">Barrio *</label>
                    <input
                      id="setup-neighborhood"
                      name="neighborhood"
                      type="text"
                      required
                      minlength="2"
                      placeholder="Ej. Chapinero Central"
                    />
                  </div>
                </div>

                <div class="fieldset-box">
                  <div class="fieldset-title">Credenciales de Administración (Dueño)</div>
                  <div class="form-row-2">
                    <div class="form-field">
                      <label for="setup-username">Usuario Dueño *</label>
                      <input
                        id="setup-username"
                        name="username"
                        type="text"
                        required
                        minlength="3"
                        value="dueno"
                      />
                    </div>
                    <div class="form-field">
                      <label for="setup-password">Contraseña *</label>
                      <input
                        id="setup-password"
                        name="password"
                        type="password"
                        required
                        minlength="6"
                        value="Password2026!"
                      />
                    </div>
                  </div>
                </div>

                <div id="auth-error" class="alert-error" role="alert" hidden></div>

                <button type="submit" id="setup-submit-btn" class="btn btn-primary btn-block">
                  Crear Tienda y Cargar 400 Productos
                </button>
              </form>
            `
              : `
              <form id="login-form" class="form-stack" autocomplete="on">
                <div class="form-field">
                  <label for="login-username">Usuario</label>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    required
                    placeholder="dueno o tendero"
                    autofocus
                  />
                </div>

                <div class="form-field">
                  <label for="login-password">Contraseña</label>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                  />
                </div>

                <div id="auth-error" class="alert-error" role="alert" hidden></div>

                <button type="submit" id="login-submit-btn" class="btn btn-primary btn-block">
                  Acceder al Panel
                </button>

                <div class="quick-role-switch">
                  <span class="section-micro-label">Acceso rápido por perfil operativo</span>
                  <div class="form-row-2">
                    <button type="button" class="btn btn-outline btn-sm" id="btn-quick-tendero">
                      ${icon('pos', 14)}
                      <span>Modo Tendero (POS)</span>
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" id="btn-quick-dueno">
                      ${icon('shield', 14)}
                      <span>Modo Dueño (Admin)</span>
                    </button>
                  </div>
                </div>
              </form>
            `
          }
        </section>
      </main>
    </div>
  `

  const themeBtn = container.querySelector('#auth-theme-toggle')
  themeBtn?.addEventListener('click', () => {
    toggleTheme()
    renderAuthScreen(container, onAuthenticated)
  })

  const errorBox = container.querySelector('#auth-error')
  function displayError(msg) {
    if (!errorBox) return
    errorBox.textContent = msg
    errorBox.hidden = false
  }

  if (isSetup) {
    const setupForm = container.querySelector('#setup-form')
    const submitBtn = container.querySelector('#setup-submit-btn')

    setupForm?.addEventListener('submit', async (e) => {
      e.preventDefault()
      errorBox.hidden = true
      const store_name = container.querySelector('#setup-store-name')?.value.trim()
      const nit = container.querySelector('#setup-nit')?.value.trim()
      const owner_name = container.querySelector('#setup-fullname')?.value.trim()
      const owner_document = container.querySelector('#setup-doc')?.value.trim()
      const address = container.querySelector('#setup-address')?.value.trim()
      const neighborhood = container.querySelector('#setup-neighborhood')?.value.trim()
      const username = container.querySelector('#setup-username')?.value.trim()
      const password = container.querySelector('#setup-password')?.value || ''

      submitBtn.disabled = true
      submitBtn.textContent = 'Inicializando tienda y 400 productos...'
      try {
        const res = await setupOwnerAccount({
          nit,
          owner_name,
          owner_document,
          store_name,
          address,
          neighborhood,
          username,
          password,
        })
        setState({
          initialized: true,
          storeProfile: res.store_profile,
          user: res.user,
        })
        await onAuthenticated(res.user)
      } catch (err) {
        displayError(err.message || 'No se pudo completar el registro de la tienda.')
        submitBtn.disabled = false
        submitBtn.textContent = 'Crear Tienda y Cargar 400 Productos'
      }
    })
  } else {
    const loginForm = container.querySelector('#login-form')
    const submitBtn = container.querySelector('#login-submit-btn')

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault()
      errorBox.hidden = true
      const username = container.querySelector('#login-username')?.value.trim()
      const password = container.querySelector('#login-password')?.value || ''

      submitBtn.disabled = true
      submitBtn.textContent = 'Verificando...'
      try {
        const res = await loginWithCredentials(username, password)
        setState({ user: res.user })
        await onAuthenticated(res.user)
      } catch (err) {
        displayError(err.message || 'Credenciales inválidas.')
        submitBtn.disabled = false
        submitBtn.textContent = 'Acceder al Panel'
      }
    })

    container.querySelector('#btn-quick-tendero')?.addEventListener('click', async () => {
      try {
        const res = await loginWithCredentials('tendero', 'Tendero2026!')
        setState({ user: res.user })
        await onAuthenticated(res.user)
      } catch (err) {
        displayError(err.message)
      }
    })

    container.querySelector('#btn-quick-dueno')?.addEventListener('click', async () => {
      try {
        const users = await import('../services/users.js').then((m) => m.fetchUsers())
        const owner = users.find((u) => u.role === 'dueno')
        if (owner) {
          const res = await loginWithCredentials(owner.username, owner.password)
          setState({ user: res.user })
          await onAuthenticated(res.user)
        }
      } catch (err) {
        displayError(err.message)
      }
    })
  }
}
