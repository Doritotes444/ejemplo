import { ROLES, isOwner } from '../core/permissions.js'
import {
  getSessionUser,
  setSessionRole,
  getOwnerPin,
  setOwnerPin,
  verifyOwnerPin,
} from '../core/session.js'
import { getState, setState, loadSavedCartForCurrentUser, reconcileCartWithCatalog, showFeedback } from '../state.js'
import { openDialog, closeDialog } from './dialog.js'

/**
 * Conmutador de Rol (Tendero / Dueño) y protección opcional con PIN local.
 * - 'Tendero': interfaz bloqueada exclusivamente a vender y descontar stock.
 * - 'Dueño': habilita en la misma pantalla el panel y los modales de productos y lotes FIFO.
 */

export function requestRoleSwitch(targetRole, onSwitched) {
  const currentUser = getSessionUser()
  if (currentUser.rol === targetRole) return

  if (targetRole === ROLES.TENDERO) {
    applyRoleSwitch(ROLES.TENDERO, onSwitched)
    showFeedback('info', 'Modo Tendero activo: interfaz bloqueada exclusivamente para ventas.')
    return
  }

  // Si pasa a Dueño y existe PIN configurado, solicitarlo en un modal limpio
  const configuredPin = getOwnerPin()
  if (configuredPin) {
    openDialog({
      title: 'Desbloquear Modo Dueño',
      subtitle: 'Ingresa el PIN local para habilitar la edición de productos y lotes FIFO.',
      width: '400px',
      contentHTML: `
        <form id="form-unlock-owner" class="form-stack">
          <div class="field">
            <label for="owner-pin-input">PIN de Dueño</label>
            <input id="owner-pin-input" type="password" inputmode="numeric" maxlength="12" placeholder="••••" required autofocus />
          </div>
          <div id="pin-error" class="form-error" hidden></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
            <button type="submit" class="btn btn-primary">Entrar como Dueño</button>
          </div>
        </form>
      `,
      onMount(modal) {
        const form = modal.querySelector('#form-unlock-owner')
        const input = modal.querySelector('#owner-pin-input')
        const errBox = modal.querySelector('#pin-error')
        input?.focus()
        form?.addEventListener('submit', (e) => {
          e.preventDefault()
          if (!verifyOwnerPin(input.value)) {
            errBox.textContent = 'PIN incorrecto.'
            errBox.hidden = false
            input.select()
            return
          }
          closeDialog()
          applyRoleSwitch(ROLES.ADMIN, onSwitched)
          showFeedback('ok', 'Modo Dueño habilitado: gestión de lotes FIFO activa en pantalla.')
        })
      },
    })
    return
  }

  applyRoleSwitch(ROLES.ADMIN, onSwitched)
  showFeedback('ok', 'Modo Dueño habilitado: gestión de lotes FIFO activa en pantalla.')
}

function applyRoleSwitch(role, onSwitched) {
  const updatedUser = setSessionRole(role)
  const st = getState()
  setState(
    {
      user: updatedUser,
      ownerDrawerOpen: isOwner(updatedUser) ? st.ownerDrawerOpen : false,
    },
    false
  )
  loadSavedCartForCurrentUser()
  reconcileCartWithCatalog(st.products)
  setState({ cart: getState().cart }, true)
  if (typeof onSwitched === 'function') {
    onSwitched(updatedUser)
  }
}

export function openOwnerSecurityModal() {
  const user = getSessionUser()
  if (!isOwner(user)) return

  const currentPin = getOwnerPin()
  openDialog({
    title: 'Seguridad Local de Mostrador (PIN)',
    subtitle: 'Configura un PIN opcional para impedir que el Tendero active el panel de Dueño sin autorización.',
    width: '440px',
    contentHTML: `
      <form id="form-owner-pin" class="form-stack">
        <div class="field">
          <label for="new-owner-pin">Nuevo PIN para Dueño (dejar vacío para desactivar)</label>
          <input id="new-owner-pin" type="password" inputmode="numeric" maxlength="12" value="${currentPin}" placeholder="Sin PIN (cambio directo)" />
          <small class="field-hint">
            Nota de arquitectura: al ser una SPA 100 % local en navegador (IndexedDB), este bloqueo protege la operación diaria en mostrador.
          </small>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar PIN</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-owner-pin')
      form?.addEventListener('submit', (e) => {
        e.preventDefault()
        const val = modal.querySelector('#new-owner-pin')?.value || ''
        setOwnerPin(val)
        closeDialog()
        showFeedback(
          'ok',
          val.trim()
            ? 'PIN de Dueño actualizado. Al cambiar de Tendero a Dueño se solicitará el PIN.'
            : 'PIN desactivado: cambio rápido entre Tendero y Dueño.'
        )
      })
    },
  })
}
