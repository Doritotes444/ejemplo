import { isOwner } from '../core/permissions.js'
import { getState, setState, showFeedback } from '../state.js'
import { createProduct, updateProduct, deactivateProduct } from '../services/products.js'
import { createLot, updateLot, deleteLot, sortLotsFIFO } from '../services/lots.js'
import { cancelSale } from '../services/sales.js'
import { exportBackupJSON, importBackupJSON, resetToDemoCatalog } from '../services/backup.js'
import { formatCOP, formatNumber } from '../utils/money.js'
import { formatQty } from '../utils/quantities.js'
import { getTodayISO, isLotExpired, daysUntilExpiration } from '../utils/validation.js'
import { comprimirImagenArchivo, resolverFotoProducto } from '../utils/images.js'
import { openDialog, closeDialog } from './dialog.js'
import { openOwnerSecurityModal } from './login.js'

const CATEGORIAS = ['Abarrotes', 'Granos', 'Lacteos', 'Bebidas', 'Snacks', 'Aseo', 'Otros']
const UNIDADES = ['unidad', 'kg', 'libra', 'litro', 'gramo', 'caja']

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Abre un modal limpio para crear o editar un producto (y su lote inicial si es nuevo).
 */
export function openProductModal(existingProduct = null, onSaved = null, prefillBarcode = '') {
  const { user } = getState()
  if (!isOwner(user)) {
    showFeedback('error', 'Solo el Dueño puede crear o editar productos.')
    return
  }

  const isEdit = Boolean(existingProduct)
  const prod = existingProduct || {
    nombre: '',
    codigo_barras: prefillBarcode || '',
    categoria: 'Abarrotes',
    unidad_medida: 'unidad',
    precio_venta: '',
    stock_minimo: 5,
    es_frecuente: true,
    foto_url: null,
  }

  const hoy = getTodayISO()
  const sugCode = `L-${hoy.replace(/-/g, '')}-01`

  openDialog({
    title: isEdit ? `Editar Producto: ${escapeHTML(prod.nombre)}` : 'Nuevo Producto + Lote Inicial (FIFO)',
    subtitle: isEdit
      ? 'Modifica los datos maestros del artículo. Las existencias se controlan por lotes FIFO.'
      : 'El stock de cada producto se deriva de sus lotes de entrada.',
    width: '600px',
    contentHTML: `
      <form id="form-product-modal" class="form-stack">
        <div class="form-grid-2">
          <div class="field">
            <label for="prd-nombre">Nombre del producto *</label>
            <input id="prd-nombre" name="nombre" type="text" required value="${escapeHTML(prod.nombre)}" placeholder="Ej. Arroz Diana 500g" />
          </div>
          <div class="field">
            <label for="prd-codigo">Código de barras / SKU *</label>
            <input id="prd-codigo" name="codigo_barras" type="text" required value="${escapeHTML(prod.codigo_barras)}" placeholder="Ej. 7702001001" />
          </div>
        </div>

        <div class="form-grid-3">
          <div class="field">
            <label for="prd-categoria">Categoría</label>
            <select id="prd-categoria" name="categoria">
              ${CATEGORIAS.map(
                (c) => `<option value="${c}" ${prod.categoria === c ? 'selected' : ''}>${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="field">
            <label for="prd-unidad">Unidad de medida</label>
            <select id="prd-unidad" name="unidad_medida">
              ${UNIDADES.map(
                (u) => `<option value="${u}" ${prod.unidad_medida === u ? 'selected' : ''}>${u}</option>`
              ).join('')}
            </select>
          </div>
          <div class="field">
            <label for="prd-minimo">Stock mínimo alerta</label>
            <input id="prd-minimo" name="stock_minimo" type="number" step="0.001" min="0" value="${prod.stock_minimo ?? 5}" />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="field">
            <label for="prd-precio">Precio de Venta Público (COP) *</label>
            <input id="prd-precio" name="precio_venta" type="number" step="50" min="1" required value="${prod.precio_venta}" placeholder="Ej. 2800" />
          </div>
          <div class="field">
            <label for="prd-foto">Fotografía opcional (se comprime en Canvas)</label>
            <input id="prd-foto" type="file" accept="image/*" />
          </div>
        </div>

        <label class="checkbox-row">
          <input id="prd-frecuente" name="es_frecuente" type="checkbox" ${prod.es_frecuente ? 'checked' : ''} />
          <span>Destacar como producto frecuente en el mostrador POS</span>
        </label>

        ${
          !isEdit
            ? `
          <fieldset class="lot-fieldset">
            <legend>Lote Inicial de Entrada (FIFO)</legend>
            <div class="form-grid-2">
              <div class="field">
                <label for="lot-init-code">Código de Lote *</label>
                <input id="lot-init-code" type="text" value="${sugCode}" required />
              </div>
              <div class="field">
                <label for="lot-init-qty">Cantidad Inicial</label>
                <input id="lot-init-qty" type="number" step="0.001" min="0" value="10" required />
              </div>
            </div>
            <div class="form-grid-3">
              <div class="field">
                <label for="lot-init-cost">Costo Unitario (COP)</label>
                <input id="lot-init-cost" type="number" step="10" min="0" value="0" required />
              </div>
              <div class="field">
                <label for="lot-init-entry">Fecha de Entrada *</label>
                <input id="lot-init-entry" type="date" value="${hoy}" required />
              </div>
              <div class="field">
                <label for="lot-init-exp">Fecha Vencimiento (opc.)</label>
                <input id="lot-init-exp" type="date" value="" />
              </div>
            </div>
          </fieldset>
        `
            : ''
        }

        <div id="prd-modal-error" class="form-error" hidden></div>

        <div class="modal-actions">
          ${
            isEdit
              ? `<button type="button" id="btn-deactivate-prd" class="btn btn-danger-outline" style="margin-right:auto">Dar de baja</button>`
              : ''
          }
          <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Producto y Lote'}</button>
        </div>
      </form>
    `,
    onMount(modal) {
      let fotoDataUrl = prod.foto_url || null
      const fileInput = modal.querySelector('#prd-foto')
      const errBox = modal.querySelector('#prd-modal-error')

      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
          fotoDataUrl = await comprimirImagenArchivo(file)
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })

      modal.querySelector('#btn-deactivate-prd')?.addEventListener('click', async () => {
        try {
          await deactivateProduct(prod.id, getState().user)
          closeDialog()
          if (onSaved) await onSaved()
          showFeedback('info', `Producto "${prod.nombre}" dado de baja.`)
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })

      modal.querySelector('#form-product-modal')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        errBox.hidden = true
        try {
          const payload = {
            nombre: modal.querySelector('#prd-nombre').value,
            codigo_barras: modal.querySelector('#prd-codigo').value,
            categoria: modal.querySelector('#prd-categoria').value,
            unidad_medida: modal.querySelector('#prd-unidad').value,
            stock_minimo: modal.querySelector('#prd-minimo').value,
            precio_venta: modal.querySelector('#prd-precio').value,
            es_frecuente: modal.querySelector('#prd-frecuente').checked,
            foto_url: fotoDataUrl,
          }

          if (isEdit) {
            await updateProduct(prod.id, payload, getState().user)
            showFeedback('ok', `Producto "${payload.nombre}" actualizado.`)
          } else {
            payload.lote_inicial = {
              codigo_lote: modal.querySelector('#lot-init-code').value,
              cantidad_disponible: modal.querySelector('#lot-init-qty').value,
              costo_unitario: modal.querySelector('#lot-init-cost').value,
              fecha_entrada: modal.querySelector('#lot-init-entry').value,
              fecha_vencimiento: modal.querySelector('#lot-init-exp').value || null,
            }
            await createProduct(payload, getState().user)
            showFeedback('ok', `Producto "${payload.nombre}" y lote inicial registrados.`)
          }

          closeDialog()
          if (onSaved) await onSaved()
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })
    },
  })
}

/**
 * Abre un modal limpio para gestionar los Lotes FIFO de un producto específico:
 * - Ver el orden exacto de salida FIFO (cuál lote se descuenta primero y cuáles están vencidos)
 * - Registrar un nuevo lote de compra (con costo unitario y vencimiento propio)
 * - Ajustar existencias, costo o fecha de vencimiento de cualquier lote existente
 */
export function openProductLotsModal(productId, onChanged = null) {
  const st = getState()
  if (!isOwner(st.user)) {
    showFeedback('error', 'Solo el Dueño puede gestionar lotes.')
    return
  }

  const product = st.products.find((p) => p.id === productId)
  if (!product) return

  const hoy = getTodayISO()

  const renderModalContent = (prod) => {
    const orderedLots = sortLotsFIFO(prod.lotes || [])
    let firstSellableMarked = false

    const rowsHTML =
      orderedLots.length === 0
        ? `<tr><td colspan="7" class="empty-cell">No hay lotes registrados para este producto.</td></tr>`
        : orderedLots
            .map((lote) => {
              const expired = isLotExpired(lote.fecha_vencimiento, hoy)
              const days = daysUntilExpiration(lote.fecha_vencimiento, hoy)
              const hasStock = Number(lote.cantidad_disponible) > 0
              const isNextFIFO = !expired && hasStock && !firstSellableMarked
              if (isNextFIFO) firstSellableMarked = true

              let badgeHTML = `<span class="badge badge-neutral">Agotado</span>`
              if (expired && hasStock) {
                badgeHTML = `<span class="badge badge-danger" title="Bloqueado automáticamente para ventas">VENCIDO (Bloqueado)</span>`
              } else if (isNextFIFO) {
                badgeHTML = `<span class="badge badge-fifo">1° EN SALIR (FIFO)</span>`
              } else if (hasStock) {
                badgeHTML = `<span class="badge badge-ok">En cola FIFO</span>`
              }

              const expText = lote.fecha_vencimiento
                ? `${escapeHTML(lote.fecha_vencimiento)} ${
                    days !== null && hasStock
                      ? `<small class="exp-hint">(${days < 0 ? `hace ${Math.abs(days)}d` : `en ${days}d`})</small>`
                      : ''
                  }`
                : '<span class="text-muted">No perecedero</span>'

              return `
                <tr class="${expired && hasStock ? 'row-expired' : ''} ${isNextFIFO ? 'row-next-fifo' : ''}">
                  <td>
                    <strong>${escapeHTML(lote.codigo_lote)}</strong>
                    ${lote.notas ? `<div class="cell-sub">${escapeHTML(lote.notas)}</div>` : ''}
                  </td>
                  <td>${escapeHTML(lote.fecha_entrada)}</td>
                  <td>${expText}</td>
                  <td>${formatCOP(lote.costo_unitario)}</td>
                  <td>
                    <strong>${formatQty(lote.cantidad_disponible, prod.unidad_medida)}</strong>
                    <div class="cell-sub">Inicial: ${formatNumber(lote.cantidad_inicial, 3)}</div>
                  </td>
                  <td>${badgeHTML}</td>
                  <td class="actions-cell">
                    <button type="button" class="btn btn-xs btn-outline" data-edit-lot="${lote.id}">Editar / Ajustar</button>
                    <button type="button" class="btn btn-xs btn-ghost-danger" data-del-lot="${lote.id}" title="Eliminar lote">✕</button>
                  </td>
                </tr>
              `
            })
            .join('')

    return `
      <div class="lots-modal-summary">
        <div class="summary-stat">
          <span class="stat-label">Disponible Venta (FIFO)</span>
          <strong class="stat-value text-success">${formatQty(prod.cantidad_disponible, prod.unidad_medida)}</strong>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Stock Vencido Bloqueado</span>
          <strong class="stat-value ${prod.cantidad_vencida > 0 ? 'text-danger' : ''}">${formatQty(prod.cantidad_vencida, prod.unidad_medida)}</strong>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Precio Venta Actual</span>
          <strong class="stat-value">${formatCOP(prod.precio_venta)}</strong>
        </div>
        <div class="summary-stat">
          <span class="stat-label">Costo Próximo Lote</span>
          <strong class="stat-value">${formatCOP(prod.precio_costo_referencia)}</strong>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código Lote</th>
              <th>Entrada</th>
              <th>Vencimiento</th>
              <th>Costo Unit.</th>
              <th>Disponible</th>
              <th>Estado FIFO</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>

      <form id="form-lot-entry" class="lot-form-box">
        <h4 id="lot-form-title">+ Registrar Nuevo Lote de Entrada</h4>
        <input type="hidden" id="editing-lot-id" value="" />
        <div class="form-grid-3">
          <div class="field">
            <label for="lot-code">Código de Lote *</label>
            <input id="lot-code" type="text" required value="L-${hoy.replace(/-/g, '')}-${String((prod.lotes?.length || 0) + 1).padStart(2, '0')}" />
          </div>
          <div class="field">
            <label for="lot-qty">Cantidad Disponible (${escapeHTML(prod.unidad_medida)}) *</label>
            <input id="lot-qty" type="number" step="0.001" min="0" required value="12" />
          </div>
          <div class="field">
            <label for="lot-cost">Costo Unitario (COP) *</label>
            <input id="lot-cost" type="number" step="10" min="0" required value="${prod.precio_costo_referencia || 0}" />
          </div>
        </div>
        <div class="form-grid-3">
          <div class="field">
            <label for="lot-entry">Fecha de Entrada *</label>
            <input id="lot-entry" type="date" required value="${hoy}" />
          </div>
          <div class="field">
            <label for="lot-exp">Fecha Vencimiento (opcional)</label>
            <input id="lot-exp" type="date" value="" />
          </div>
          <div class="field">
            <label for="lot-notes">Nota / Proveedor</label>
            <input id="lot-notes" type="text" placeholder="Ej. Remesa distribuidora" />
          </div>
        </div>
        <div id="lot-form-error" class="form-error" hidden></div>
        <div class="modal-actions">
          <button type="button" id="btn-cancel-lot-edit" class="btn btn-ghost" hidden>Cancelar edición</button>
          <button type="button" class="btn btn-outline" id="btn-edit-product-meta">Editar datos del producto</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-lot">Guardar Lote</button>
        </div>
      </form>
    `
  }

  openDialog({
    title: `Lotes FIFO · ${escapeHTML(product.nombre)}`,
    subtitle: `Código: ${escapeHTML(product.codigo_barras)} · Se descuentan primero los lotes con fecha de entrada más antigua (y vencimiento más próximo). Los lotes vencidos se bloquean automáticamente.`,
    width: '860px',
    contentHTML: renderModalContent(product),
    onMount(modal) {
      const bindEvents = () => {
        const freshProd = getState().products.find((p) => p.id === productId)
        if (!freshProd) {
          closeDialog()
          return
        }

        const form = modal.querySelector('#form-lot-entry')
        const errBox = modal.querySelector('#lot-form-error')
        const editingIdInput = modal.querySelector('#editing-lot-id')
        const formTitle = modal.querySelector('#lot-form-title')
        const cancelEditBtn = modal.querySelector('#btn-cancel-lot-edit')
        const submitBtn = modal.querySelector('#btn-submit-lot')

        modal.querySelectorAll('[data-edit-lot]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const lotId = btn.getAttribute('data-edit-lot')
            const targetLot = (freshProd.lotes || []).find((l) => l.id === lotId)
            if (!targetLot) return
            editingIdInput.value = targetLot.id
            formTitle.textContent = `Editando Lote: ${targetLot.codigo_lote}`
            modal.querySelector('#lot-code').value = targetLot.codigo_lote
            modal.querySelector('#lot-qty').value = targetLot.cantidad_disponible
            modal.querySelector('#lot-cost').value = targetLot.costo_unitario
            modal.querySelector('#lot-entry').value = targetLot.fecha_entrada
            modal.querySelector('#lot-exp').value = targetLot.fecha_vencimiento || ''
            modal.querySelector('#lot-notes').value = targetLot.notas || ''
            submitBtn.textContent = 'Actualizar Lote'
            cancelEditBtn.hidden = false
            modal.querySelector('#lot-qty').focus()
          })
        })

        cancelEditBtn?.addEventListener('click', () => {
          const body = modal.querySelector('.modal-body')
          body.innerHTML = renderModalContent(freshProd)
          bindEvents()
        })

        modal.querySelectorAll('[data-del-lot]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const lotId = btn.getAttribute('data-del-lot')
            try {
              await deleteLot(lotId, getState().user)
              if (onChanged) await onChanged()
              const updatedProd = getState().products.find((p) => p.id === productId)
              const body = modal.querySelector('.modal-body')
              body.innerHTML = renderModalContent(updatedProd)
              bindEvents()
              showFeedback('info', 'Lote eliminado y registrado en kardex.')
            } catch (err) {
              errBox.textContent = err.message
              errBox.hidden = false
            }
          })
        })

        modal.querySelector('#btn-edit-product-meta')?.addEventListener('click', () => {
          openProductModal(freshProd, onChanged)
        })

        form?.addEventListener('submit', async (e) => {
          e.preventDefault()
          errBox.hidden = true
          const editingId = editingIdInput.value
          const payload = {
            producto_id: productId,
            codigo_lote: modal.querySelector('#lot-code').value,
            cantidad_disponible: modal.querySelector('#lot-qty').value,
            costo_unitario: modal.querySelector('#lot-cost').value,
            fecha_entrada: modal.querySelector('#lot-entry').value,
            fecha_vencimiento: modal.querySelector('#lot-exp').value || null,
            notas: modal.querySelector('#lot-notes').value,
          }

          try {
            if (editingId) {
              await updateLot(editingId, payload, getState().user)
              showFeedback('ok', `Lote ${payload.codigo_lote} actualizado.`)
            } else {
              await createLot(payload, getState().user)
              showFeedback('ok', `Nuevo lote ${payload.codigo_lote} ingresado a la cola FIFO.`)
            }
            if (onChanged) await onChanged()
            const updatedProd = getState().products.find((p) => p.id === productId)
            const body = modal.querySelector('.modal-body')
            body.innerHTML = renderModalContent(updatedProd)
            bindEvents()
          } catch (err) {
            errBox.textContent = err.message
            errBox.hidden = false
          }
        })
      }

      bindEvents()
    },
  })
}

/**
 * Modal de Anulación de Venta con devolución exacta a los lotes originales.
 */
export function openCancelSaleModal(sale, onCancelled) {
  const { user } = getState()
  if (!isOwner(user)) return

  openDialog({
    title: `Anular Venta #${escapeHTML(sale.id.slice(0, 8))}`,
    subtitle: `Se devolverán las unidades vendidas exactamente a sus lotes originales y quedará trazabilidad en el kardex.`,
    width: '460px',
    contentHTML: `
      <form id="form-cancel-sale" class="form-stack">
        <div class="sale-summary-chip">
          Total: <strong>${formatCOP(sale.total)}</strong> · Método: <strong>${escapeHTML(sale.metodo_pago)}</strong>
        </div>
        <div class="field">
          <label for="cancel-reason">Motivo de anulación (obligatorio) *</label>
          <input id="cancel-reason" type="text" required minlength="3" placeholder="Ej. Error de digitación o devolución del cliente" autofocus />
        </div>
        <div id="cancel-error" class="form-error" hidden></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Volver</button>
          <button type="submit" class="btn btn-danger">Confirmar Anulación y Revertir Lotes</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-cancel-sale')
      const errBox = modal.querySelector('#cancel-error')
      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const reason = modal.querySelector('#cancel-reason').value
        try {
          await cancelSale(sale.id, reason, getState().user)
          closeDialog()
          if (onCancelled) await onCancelled()
          showFeedback('ok', 'Venta anulada: existencias restauradas en sus lotes originales.')
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })
    },
  })
}

/**
 * Renderiza el Panel Integrado de Dueño (en la misma pantalla que el POS).
 * Solo se muestra cuando el usuario activo tiene rol 'Dueño' (admin).
 */
export function renderOwnerSectionHTML(state) {
  if (!isOwner(state.user)) {
    return ''
  }

  const hoy = getTodayISO()
  const totalProductos = state.products.length
  const totalLotesActivos = state.products.reduce((acc, p) => acc + (p.lotes_activos || 0), 0)
  const totalLotesVencidos = state.products.reduce((acc, p) => acc + (p.lotes_vencidos || 0), 0)
  const valorInventarioCosto = state.products.reduce((acc, p) => {
    const sub = (p.lotes || []).reduce((s, l) => {
      if (isLotExpired(l.fecha_vencimiento, hoy)) return s
      return s + Number(l.cantidad_disponible || 0) * Number(l.costo_unitario || 0)
    }, 0)
    return acc + sub
  }, 0)

  const activeTab = state.ownerPanelTab || 'lotes'

  let tabBodyHTML = ''
  if (activeTab === 'lotes') {
    tabBodyHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio Venta</th>
              <th>Disponible (FIFO)</th>
              <th>Próximo Lote en Salir</th>
              <th>Lotes Activos / Vencidos</th>
              <th>Acciones Dueño</th>
            </tr>
          </thead>
          <tbody>
            ${state.products
              .map((p) => {
                const next = p.proximo_lote
                const lowStock = p.cantidad_disponible <= p.stock_minimo
                return `
                  <tr>
                    <td>
                      <div class="prod-row-cell">
                        <img src="${resolverFotoProducto(p)}" alt="" class="prod-thumb-xs" />
                        <div>
                          <strong>${escapeHTML(p.nombre)}</strong>
                          <div class="cell-sub">${escapeHTML(p.codigo_barras)} · ${escapeHTML(p.categoria)}</div>
                        </div>
                      </div>
                    </td>
                    <td><strong>${formatCOP(p.precio_venta)}</strong></td>
                    <td>
                      <span class="stock-pill ${p.cantidad_disponible <= 0 ? 'pill-zero' : lowStock ? 'pill-low' : 'pill-ok'}">
                        ${formatQty(p.cantidad_disponible, p.unidad_medida)}
                      </span>
                    </td>
                    <td>
                      ${
                        next
                          ? `<span class="badge badge-fifo">${escapeHTML(next.codigo_lote)}</span>
                             <div class="cell-sub">Entró: ${escapeHTML(next.fecha_entrada)} · Costo: ${formatCOP(next.costo_unitario)}</div>`
                          : '<span class="text-muted">Sin lote vendible</span>'
                      }
                    </td>
                    <td>
                      <span>${p.lotes_activos} activos</span>
                      ${
                        p.lotes_vencidos > 0
                          ? ` · <span class="badge badge-danger">${p.lotes_vencidos} vencido (${formatQty(p.cantidad_vencida, p.unidad_medida)})</span>`
                          : ''
                      }
                    </td>
                    <td class="actions-cell">
                      <button type="button" class="btn btn-xs btn-primary" data-manage-lots="${p.id}">Lotes FIFO (${(p.lotes || []).length})</button>
                      <button type="button" class="btn btn-xs btn-outline" data-edit-product="${p.id}">Editar</button>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
  } else if (activeTab === 'ventas') {
    const sales = state.sales || []
    tabBodyHTML =
      sales.length === 0
        ? `<div class="empty-box">Aún no se han registrado ventas en esta sesión.</div>`
        : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Vendedor</th>
              <th>Método</th>
              <th>Detalle y Lotes Descontados (FIFO)</th>
              <th>Total</th>
              <th>Estado / Acción</th>
            </tr>
          </thead>
          <tbody>
            ${sales
              .slice(0, 40)
              .map((v) => {
                const isCancelled = v.estado === 'ANULADA'
                const fechaTexto = new Date(v.fecha_venta).toLocaleString('es-CO', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
                const detallesHTML = (v.detalles || [])
                  .map((d) => {
                    const lotesStr = (d.asignaciones_lote || [])
                      .map((a) => `${escapeHTML(a.codigo_lote)}: -${a.cantidad_descontada}`)
                      .join(', ')
                    return `<div><strong>${escapeHTML(d.producto_nombre)}</strong> × ${d.cantidad} <small class="text-muted">[${lotesStr}]</small></div>`
                  })
                  .join('')

                return `
                  <tr class="${isCancelled ? 'row-expired' : ''}">
                    <td>
                      <div>${escapeHTML(fechaTexto)}</div>
                      <small class="text-muted">#${escapeHTML(v.id.slice(0, 8))}</small>
                    </td>
                    <td>${escapeHTML(v.vendedor_nombre)} <small class="text-muted">(${escapeHTML(v.vendedor_rol)})</small></td>
                    <td><span class="badge badge-neutral">${escapeHTML(v.metodo_pago)}</span></td>
                    <td>
                      ${detallesHTML}
                      ${isCancelled ? `<div class="text-danger"><small>Motivo anulación: ${escapeHTML(v.motivo_anulacion)}</small></div>` : ''}
                    </td>
                    <td><strong class="${isCancelled ? 'line-through' : ''}">${formatCOP(v.total)}</strong></td>
                    <td>
                      ${
                        isCancelled
                          ? `<span class="badge badge-danger">ANULADA</span>`
                          : `<button type="button" class="btn btn-xs btn-danger-outline" data-cancel-sale="${v.id}">Anular y Revertir</button>`
                      }
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
  } else {
    const movs = state.movements || []
    tabBodyHTML =
      movs.length === 0
        ? `<div class="empty-box">Sin movimientos de kardex registrados.</div>`
        : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Lote</th>
              <th>Cambio</th>
              <th>Stock Lote</th>
              <th>Usuario / Motivo</th>
            </tr>
          </thead>
          <tbody>
            ${movs
              .slice(0, 50)
              .map((m) => {
                const fechaTexto = new Date(m.created_at).toLocaleString('es-CO', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
                const sign = m.cantidad > 0 ? `+${m.cantidad}` : `${m.cantidad}`
                return `
                  <tr>
                    <td><small>${escapeHTML(fechaTexto)}</small></td>
                    <td><span class="badge badge-neutral">${escapeHTML(m.tipo)}</span></td>
                    <td><strong>${escapeHTML(m.codigo_lote || m.lote_id?.slice(0, 8))}</strong></td>
                    <td class="${m.cantidad >= 0 ? 'text-success' : 'text-danger'}"><strong>${sign}</strong></td>
                    <td>${m.stock_anterior} → <strong>${m.stock_nuevo}</strong></td>
                    <td>
                      <div>${escapeHTML(m.motivo)}</div>
                      <small class="text-muted">Por: ${escapeHTML(m.usuario_nombre)}</small>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
  }

  return `
    <section class="owner-integrated-panel" aria-label="Panel de Control del Dueño">
      <div class="owner-panel-header">
        <div>
          <div class="owner-badge-row">
            <span class="badge badge-owner">PANEL DUEÑO INTEGRADO</span>
            <span class="text-muted">Método FIFO + Bloqueo automático de lotes vencidos</span>
          </div>
          <h2>Gestión de Productos, Lotes FIFO y Kardex</h2>
        </div>
        <div class="owner-header-actions">
          <button type="button" class="btn btn-primary" id="btn-owner-new-product">+ Nuevo Producto</button>
          <button type="button" class="btn btn-outline" id="btn-owner-pin-config">PIN Mostrador</button>
          <button type="button" class="btn btn-outline" id="btn-owner-export-json">Exportar Respaldo</button>
          <label class="btn btn-outline file-btn-label">
            Importar JSON
            <input type="file" id="input-owner-import-json" accept="application/json" hidden />
          </label>
          <button type="button" class="btn btn-ghost" id="btn-owner-reset-demo" title="Restaurar datos de demostración">Restaurar Demo</button>
        </div>
      </div>

      <div class="owner-kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Productos Activos</span>
          <strong class="kpi-value">${totalProductos}</strong>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Lotes Vigentes en Cola FIFO</span>
          <strong class="kpi-value text-success">${totalLotesActivos}</strong>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Lotes Vencidos Bloqueados</span>
          <strong class="kpi-value ${totalLotesVencidos > 0 ? 'text-danger' : ''}">${totalLotesVencidos}</strong>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Valor Inventario Vigente (Costo)</span>
          <strong class="kpi-value">${formatCOP(valorInventarioCosto)}</strong>
        </div>
      </div>

      <div class="owner-tabs">
        <button type="button" class="tab-btn ${activeTab === 'lotes' ? 'active' : ''}" data-owner-tab="lotes">
          Inventario por Lotes (FIFO)
        </button>
        <button type="button" class="tab-btn ${activeTab === 'ventas' ? 'active' : ''}" data-owner-tab="ventas">
          Ventas y Anulaciones (${(state.sales || []).length})
        </button>
        <button type="button" class="tab-btn ${activeTab === 'kardex' ? 'active' : ''}" data-owner-tab="kardex">
          Kardex de Movimientos (${(state.movements || []).length})
        </button>
      </div>

      <div class="owner-tab-content">
        ${tabBodyHTML}
      </div>
    </section>
  `
}

export function bindOwnerSectionEvents(root, refreshAllData) {
  const st = getState()
  if (!isOwner(st.user)) return

  root.querySelector('#btn-owner-new-product')?.addEventListener('click', () => {
    openProductModal(null, refreshAllData)
  })

  root.querySelector('#btn-owner-pin-config')?.addEventListener('click', () => {
    openOwnerSecurityModal()
  })

  root.querySelector('#btn-owner-export-json')?.addEventListener('click', async () => {
    const backup = await exportBackupJSON(st.user.tienda_id)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tiendapp_fifo_backup_${getTodayISO()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showFeedback('ok', 'Respaldo JSON descargado correctamente.')
  })

  root.querySelector('#input-owner-import-json')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const stats = await importBackupJSON(parsed, getState().user)
      await refreshAllData()
      showFeedback('ok', `Respaldo importado: ${stats.productos} productos y ${stats.lotes} lotes.`)
    } catch (err) {
      showFeedback('error', err.message || 'Error importando archivo JSON.')
    }
  })

  root.querySelector('#btn-owner-reset-demo')?.addEventListener('click', async () => {
    await resetToDemoCatalog(st.user.tienda_id)
    setState({ cart: [] }, false)
    await refreshAllData()
    showFeedback('info', 'Catálogo y lotes FIFO de demostración restaurados.')
  })

  root.querySelectorAll('[data-owner-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ ownerPanelTab: btn.getAttribute('data-owner-tab') })
    })
  })

  root.querySelectorAll('[data-manage-lots]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openProductLotsModal(btn.getAttribute('data-manage-lots'), refreshAllData)
    })
  })

  root.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = getState().products.find((p) => p.id === btn.getAttribute('data-edit-product'))
      if (prod) openProductModal(prod, refreshAllData)
    })
  })

  root.querySelectorAll('[data-cancel-sale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sale = (getState().sales || []).find((s) => s.id === btn.getAttribute('data-cancel-sale'))
      if (sale) openCancelSaleModal(sale, refreshAllData)
    })
  })
}
