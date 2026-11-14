import { BRAND_LOGO_SVG, icon } from './icons.js'
import { getTheme, toggleTheme } from '../core/theme.js'
import { setupOwnerAccount, loginWithCredentials } from '../core/session.js'
import { getState } from '../state.js'

/**
 * Vista de Autenticación y Asistente de Inicialización Segura del Primer Dueño.
 * No expone ni utiliza credenciales predeterminadas.
 */

export function renderAuthScreen(root, onAuthenticated) {
  const st = getState()
  const isSetupMode = !st.initialized
  const theme = getTheme()

  root.innerHTML = `
    <div class="auth-layout">
      <header class="auth-topbar">
        <div class="auth-brand">
          ${BRAND_LOGO_SVG}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-auth-theme" aria-label="Alternar tema">
          ${theme === 'dark' ? icon('sun', 15) : icon('moon', 15)}
          <span>${theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </button>
      </header>

      <main class="auth-main">
        <section class="auth-card" aria-labelledby="auth-heading">
          <div class="auth-card-header">
            <span class="status-tag">${isSetupMode ? 'Inicialización del Sistema' : 'Control de Acceso'}</span>
            <h1 id="auth-heading">
              ${isSetupMode ? 'Configurar cuenta principal de Dueño' : 'Iniciar sesión en Kairo'}
            </h1>
            <p class="auth-description">
              ${
                isSetupMode
                  ? 'La base de datos está limpia. Registra las credenciales del primer usuario Dueño para inicializar el sistema de forma segura.'
                  : 'Ingresa con tu usuario asignado para acceder al Punto de Venta o a la administración.'
              }
            </p>
          </div>

          <form id="auth-form" class="form-stack" autocomplete="off">
            ${
              isSetupMode
                ? `
              <div class="form-field">
                <label for="auth-fullname">Nombre completo del Dueño</label>
                <input id="auth-fullname" name="full_name" type="text" required minlength="2" placeholder="Ej. Carlos Mendoza" autofocus />
              </div>
            `
                : ''
            }

            <div class="form-field">
              <label for="auth-username">Nombre de usuario</label>
              <input
                id="auth-username"
                name="username"
                type="text"
                required
                minlength="3"
                placeholder="Ej. cmendoza"
                ${!isSetupMode ? 'autofocus' : ''}
              />
            </div>

            <div class="form-field">
              <label for="auth-password">Contraseña ${isSetupMode ? '(mínimo 8 caracteres)' : ''}</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                required
                minlength="${isSetupMode ? '8' : '1'}"
                placeholder="••••••••"
              />
            </div>

            <div id="auth-error-box" class="alert-error" hidden></div>

            <button type="submit" id="btn-auth-submit" class="btn btn-primary btn-block">
              ${isSetupMode ? 'Inicializar Sistema y Entrar' : 'Iniciar Sesión'}
            </button>
          </form>
        </section>
      </main>
    </div>
  `

  root.querySelector('#btn-auth-theme')?.addEventListener('click', () => {
    toggleTheme()
    renderAuthScreen(root, onAuthenticated)
  })

  const form = root.querySelector('#auth-form')
  const errBox = root.querySelector('#auth-error-box')
  const submitBtn = root.querySelector('#btn-auth-submit')

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    errBox.hidden = true
    submitBtn.disabled = true
    const originalText = submitBtn.textContent
    submitBtn.textContent = 'Verificando...'

    try {
      const username = root.querySelector('#auth-username').value.trim()
      const password = root.querySelector('#auth-password').value

      let res
      if (isSetupMode) {
        const fullName = root.querySelector('#auth-fullname').value.trim()
        res = await setupOwnerAccount({
          full_name: fullName,
          username,
          password,
        })
      } else {
        res = await loginWithCredentials(username, password)
      }

      if (typeof onAuthenticated === 'function') {
        await onAuthenticated(res.user)
      }
    } catch (err) {
      errBox.textContent = err.message || 'No fue posible autenticar la sesión.'
      errBox.hidden = false
      submitBtn.disabled = false
      submitBtn.textContent = originalText
    }
  })
}
