import { isOwner } from '../core/permissions.js'
import { getState, setState, showToast } from '../state.js'
import {
  createProductRequest,
  updateProductRequest,
  createCategoryRequest,
} from '../services/products.js'
import { createLotRequest, adjustLotRequest } from '../services/lots.js'
import { createUserRequest, updateUserRequest } from '../services/users.js'
import { fetchSales } from '../services/sales.js'
import { formatCOP } from '../utils/money.js'
import { formatQty } from '../utils/quantities.js'
import { getTodayISO } from '../utils/validation.js'
import { icon } from './icons.js'
import { openDialog, closeDialog } from './dialog.js'
import { openSaleReceiptModal } from './receipt.js'

const UNITS = [
  { code: 'und', label: 'Unidad (und)' },
  { code: 'kg', label: 'Kilogramo (kg)' },
  { code: 'lb', label: 'Libra (lb)' },
  { code: 'lt', label: 'Litro (lt)' },
  { code: 'gr', label: 'Gramo (gr)' },
  { code: 'caja', label: 'Caja' },
]

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// =============================================================================
// 1. GESTIÓN DE PRODUCTOS Y CATEGORÍAS
// =============================================================================

export function renderProductsViewHTML(st) {
  if (!isOwner(st.user)) return ''

  const q = String(st.productSearch || '').trim().toLowerCase()
  const catFilter = st.productCategoryFilter || 'ALL'
  const showInactive = Boolean(st.productShowInactive)

  const filtered = (st.products || []).filter((p) => {
    if (!showInactive && !p.is_active) return false
    if (catFilter !== 'ALL' && p.category_id !== catFilter) return false
    if (!q) return true
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    )
  })

  const rowsHTML =
    filtered.length === 0
      ? `<tr><td colspan="7" class="empty-cell">No hay productos registrados que coincidan con el filtro.</td></tr>`
      : filtered
          .map((p) => {
            const avail = Number(p.available_stock || 0)
            let stockBadge = `<span class="status-badge badge-success">${formatQty(avail, p.unit)}</span>`
            if (avail <= 0) {
              stockBadge = `<span class="status-badge badge-danger">Agotado (0)</span>`
            } else if (p.is_low_stock) {
              stockBadge = `<span class="status-badge badge-warning">Bajo (${formatQty(avail, p.unit)})</span>`
            }

            return `
              <tr class="${!p.is_active ? 'row-inactive' : ''}">
                <td class="mono">${escapeHTML(p.sku)}${p.barcode ? `<div class="cell-sub">${escapeHTML(p.barcode)}</div>` : ''}</td>
                <td>
                  <strong>${escapeHTML(p.name)}</strong>
                </td>
                <td>${escapeHTML(p.category_name)}</td>
                <td class="num"><strong>${formatCOP(p.sale_price)}</strong> <small class="text-muted">/ ${escapeHTML(p.unit)}</small></td>
                <td>
                  ${stockBadge}
                  <div class="cell-sub">Mínimo: ${p.min_stock} ${escapeHTML(p.unit)}</div>
                </td>
                <td>
                  <span class="status-badge ${p.is_active ? 'badge-neutral' : 'badge-danger'}">
                    ${p.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="actions-cell">
                  <button type="button" class="btn btn-outline btn-xs" data-prod-add-lot="${p.id}">
                    ${icon('plus', 12)} Lote
                  </button>
                  <button type="button" class="btn btn-outline btn-xs" data-prod-edit="${p.id}">
                    ${icon('edit', 12)} Editar
                  </button>
                  <button type="button" class="btn btn-ghost btn-xs" data-prod-toggle="${p.id}">
                    ${p.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            `
          })
          .join('')

  return `
    <section class="admin-section">
      <header class="section-header-bar">
        <div>
          <h1 class="page-title">Catálogo de Productos</h1>
          <p class="page-subtitle">Define códigos SKU, precios de venta, categorías y parámetros de stock mínimo.</p>
        </div>
        <div class="header-actions-group">
          <button type="button" class="btn btn-outline" id="btn-new-category">
            ${icon('plus', 15)}
            <span>Nueva Categoría</span>
          </button>
          <button type="button" class="btn btn-primary" id="btn-new-product">
            ${icon('plus', 15)}
            <span>Nuevo Producto</span>
          </button>
        </div>
      </header>

      <div class="filter-toolbar">
        <div class="search-field-wrapper">
          ${icon('search', 15, 'search-icon')}
          <input
            id="prod-search-input"
            type="search"
            value="${escapeHTML(st.productSearch)}"
            placeholder="Filtrar por nombre, SKU o código de barras..."
          />
        </div>
        <select id="prod-cat-select" class="select-compact">
          <option value="ALL">Todas las categorías</option>
          ${(st.categories || [])
            .map(
              (c) => `<option value="${c.id}" ${st.productCategoryFilter === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`
            )
            .join('')}
        </select>
        <label class="checkbox-inline">
          <input id="prod-show-inactive" type="checkbox" ${st.productShowInactive ? 'checked' : ''} />
          <span>Mostrar inactivos</span>
        </label>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU / Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th class="num">Precio Venta</th>
              <th>Existencia Vigente</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function bindProductsViewEvents(root, refreshAll) {
  const searchInput = root.querySelector('#prod-search-input')
  searchInput?.addEventListener('input', (e) => {
    setState({ productSearch: e.target.value })
    const el = document.querySelector('#prod-search-input')
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  })

  root.querySelector('#prod-cat-select')?.addEventListener('change', (e) => {
    setState({ productCategoryFilter: e.target.value })
  })

  root.querySelector('#prod-show-inactive')?.addEventListener('change', (e) => {
    setState({ productShowInactive: e.target.checked })
  })

  root.querySelector('#btn-new-category')?.addEventListener('click', () => {
    openCategoryModal(refreshAll)
  })

  root.querySelector('#btn-new-product')?.addEventListener('click', () => {
    openProductFormModal(null, refreshAll)
  })

  root.querySelectorAll('[data-prod-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-prod-edit')
      const prod = getState().products.find((p) => p.id === pid)
      if (prod) openProductFormModal(prod, refreshAll)
    })
  })

  root.querySelectorAll('[data-prod-add-lot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-prod-add-lot')
      openCreateLotModal(pid, refreshAll)
    })
  })

  root.querySelectorAll('[data-prod-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-prod-toggle')
      const prod = getState().products.find((p) => p.id === pid)
      if (!prod) return
      openConfirmToggleProductModal(prod, refreshAll)
    })
  })
}

function openCategoryModal(refreshAll) {
  openDialog({
    title: 'Nueva Categoría',
    subtitle: 'Organiza el catálogo de productos para agilizar búsquedas y filtros.',
    maxWidth: '420px',
    bodyHTML: `
      <form id="form-category" class="form-stack">
        <div class="form-field">
          <label for="cat-name">Nombre de la categoría *</label>
          <input id="cat-name" type="text" required minlength="2" placeholder="Ej. Panadería" autofocus />
        </div>
        <div class="form-field">
          <label for="cat-desc">Descripción (opcional)</label>
          <input id="cat-desc" type="text" placeholder="Productos horneados y frescos" />
        </div>
        <div id="cat-error" class="alert-error" hidden></div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Categoría</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-category')
      const errBox = modal.querySelector('#cat-error')
      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        errBox.hidden = true
        try {
          await createCategoryRequest({
            name: modal.querySelector('#cat-name').value.trim(),
            description: modal.querySelector('#cat-desc').value.trim(),
          })
          closeDialog()
          await refreshAll()
          showToast('ok', 'Categoría registrada correctamente.')
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })
    },
  })
}

export function openProductFormModal(product = null, refreshAll) {
  const isEdit = Boolean(product)
  const st = getState()
  const today = getTodayISO()

  openDialog({
    title: isEdit ? `Editar Producto · ${escapeHTML(product.sku)}` : 'Crear Nuevo Producto',
    subtitle: isEdit
      ? 'Actualiza la información comercial del producto.'
      : 'Registra los datos maestros y opcionalmente su lote de apertura.',
    maxWidth: '580px',
    bodyHTML: `
      <form id="form-product" class="form-stack">
        <div class="form-row-2">
          <div class="form-field">
            <label for="p-name">Nombre del producto *</label>
            <input id="p-name" type="text" required minlength="2" value="${escapeHTML(product?.name || '')}" placeholder="Ej. Café Molido 500g" autofocus />
          </div>
          <div class="form-field">
            <label for="p-cat">Categoría</label>
            <select id="p-cat">
              <option value="">Sin categoría</option>
              ${(st.categories || [])
                .map(
                  (c) => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="form-row-3">
          <div class="form-field">
            <label for="p-sku">Código SKU *</label>
            <input id="p-sku" type="text" required value="${escapeHTML(product?.sku || '')}" placeholder="Ej. CAF-500" />
          </div>
          <div class="form-field">
            <label for="p-barcode">Código de barras (EAN)</label>
            <input id="p-barcode" type="text" value="${escapeHTML(product?.barcode || '')}" placeholder="Ej. 7702001099" />
          </div>
          <div class="form-field">
            <label for="p-unit">Unidad de medida</label>
            <select id="p-unit">
              ${UNITS.map(
                (u) => `<option value="${u.code}" ${product?.unit === u.code ? 'selected' : ''}>${u.label}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-field">
            <label for="p-price">Precio de Venta (COP) *</label>
            <input id="p-price" type="number" step="any" min="1" required value="${product?.sale_price ?? ''}" placeholder="Ej. 14500" />
          </div>
          <div class="form-field">
            <label for="p-min">Alerta de stock mínimo</label>
            <input id="p-min" type="number" step="0.001" min="0" required value="${product?.min_stock ?? 5}" />
          </div>
        </div>

        ${
          !isEdit
            ? `
          <div class="fieldset-box">
            <div class="fieldset-title">Lote de Ingreso Inicial (Opcional)</div>
            <div class="form-row-3">
              <div class="form-field">
                <label for="p-lot-num">N.° de Lote</label>
                <input id="p-lot-num" type="text" value="L-${today.replace(/-/g, '')}-01" />
              </div>
              <div class="form-field">
                <label for="p-lot-qty">Cantidad Inicial</label>
                <input id="p-lot-qty" type="number" step="0.001" min="0" value="0" />
              </div>
              <div class="form-field">
                <label for="p-lot-cost">Costo Unitario (COP)</label>
                <input id="p-lot-cost" type="number" step="any" min="0" value="0" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-field">
                <label for="p-lot-entry">Fecha de Ingreso</label>
                <input id="p-lot-entry" type="date" value="${today}" />
              </div>
              <div class="form-field">
                <label for="p-lot-exp">Fecha de Vencimiento</label>
                <input id="p-lot-exp" type="date" value="" />
              </div>
            </div>
          </div>
        `
            : ''
        }

        <div id="p-error" class="alert-error" hidden></div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Producto'}</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-product')
      const errBox = modal.querySelector('#p-error')

      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        errBox.hidden = true
        try {
          const payload = {
            name: modal.querySelector('#p-name').value.trim(),
            category_id: modal.querySelector('#p-cat').value || null,
            sku: modal.querySelector('#p-sku').value.trim(),
            barcode: modal.querySelector('#p-barcode').value.trim() || null,
            unit: modal.querySelector('#p-unit').value,
            sale_price: Number(modal.querySelector('#p-price').value),
            min_stock: Number(modal.querySelector('#p-min').value),
          }

          if (isEdit) {
            await updateProductRequest(product.id, payload)
            showToast('ok', `Producto "${payload.name}" actualizado.`)
          } else {
            const initQty = Number(modal.querySelector('#p-lot-qty').value || 0)
            if (initQty > 0) {
              payload.initial_lot = {
                lot_number: modal.querySelector('#p-lot-num').value.trim(),
                quantity: initQty,
                unit_cost: Number(modal.querySelector('#p-lot-cost').value || 0),
                entry_date: modal.querySelector('#p-lot-entry').value,
                expiration_date: modal.querySelector('#p-lot-exp').value || null,
              }
            }
            await createProductRequest(payload)
            showToast('ok', `Producto "${payload.name}" creado correctamente.`)
          }

          closeDialog()
          await refreshAll()
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })
    },
  })
}

function openConfirmToggleProductModal(product, refreshAll) {
  const nextState = !product.is_active
  openDialog({
    title: `${nextState ? 'Activar' : 'Desactivar'} Producto`,
    subtitle: `Confirmación de cambio de estado para "${escapeHTML(product.name)}".`,
    maxWidth: '440px',
    bodyHTML: `
      <p class="confirm-text">
        ${
          nextState
            ? 'El producto volverá a estar visible y habilitado en el Punto de Venta.'
            : 'El producto dejará de aparecer en el Punto de Venta, conservando intacto su historial de ventas y lotes.'
        }
      </p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
        <button type="button" id="btn-confirm-toggle-prod" class="btn ${nextState ? 'btn-primary' : 'btn-danger'}">
          ${nextState ? 'Confirmar Activación' : 'Confirmar Desactivación'}
        </button>
      </div>
    `,
    onMount(modal) {
      modal.querySelector('#btn-confirm-toggle-prod')?.addEventListener('click', async () => {
        try {
          await updateProductRequest(product.id, { is_active: nextState })
          closeDialog()
          await refreshAll()
          showToast('ok', `Producto ${nextState ? 'activado' : 'desactivado'}.`)
        } catch (err) {
          showToast('error', err.message)
        }
      })
    },
  })
}

// =============================================================================
// 2. GESTIÓN DE LOTES (FEFO / FIFO + VENCIMIENTOS)
// =============================================================================

export function renderLotsViewHTML(st) {
  if (!isOwner(st.user)) return ''

  const statusFilter = st.lotFilterStatus || 'ALL'
  const prodFilter = st.lotFilterProduct || 'ALL'
  const lots = st.lots || []

  const filtered = lots.filter((l) => {
    if (prodFilter !== 'ALL' && l.product_id !== prodFilter) return false
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false
    return true
  })

  const totalAvailableCount = lots.filter((l) => l.status === 'DISPONIBLE').length
  const totalExpiringSoon = lots.filter((l) => l.status === 'PROXIMO_A_VENCER').length
  const totalExpired = lots.filter((l) => l.status === 'VENCIDO').length

  const rowsHTML =
    filtered.length === 0
      ? `<tr><td colspan="8" class="empty-cell">No se encontraron lotes para los criterios seleccionados.</td></tr>`
      : filtered
          .map((l) => {
            let badge = `<span class="status-badge badge-success">Disponible</span>`
            if (l.status === 'VENCIDO') {
              badge = `<span class="status-badge badge-danger">Vencido (Bloqueado)</span>`
            } else if (l.status === 'PROXIMO_A_VENCER') {
              badge = `<span class="status-badge badge-warning">Vence en ${l.days_to_expire}d</span>`
            } else if (l.status === 'AGOTADO') {
              badge = `<span class="status-badge badge-neutral">Agotado</span>`
            }

            return `
              <tr class="${l.status === 'VENCIDO' ? 'row-expired' : ''}">
                <td class="mono"><strong>${escapeHTML(l.lot_number)}</strong></td>
                <td>
                  <strong>${escapeHTML(l.product_name)}</strong>
                  <div class="cell-sub">SKU: ${escapeHTML(l.product_sku)}</div>
                </td>
                <td>${escapeHTML(l.entry_date)}</td>
                <td>${l.expiration_date ? escapeHTML(l.expiration_date) : '<span class="text-muted">No perecedero</span>'}</td>
                <td class="num">${formatCOP(l.unit_cost)}</td>
                <td class="num">
                  <strong>${formatQty(l.available_quantity, l.product_unit)}</strong>
                  <div class="cell-sub">Inicial: ${l.initial_quantity}</div>
                </td>
                <td>${badge}</td>
                <td class="actions-cell">
                  <button type="button" class="btn btn-outline btn-xs" data-lot-adjust="${l.id}">
                    Movimiento / Ajuste
                  </button>
                </td>
              </tr>
            `
          })
          .join('')

  return `
    <section class="admin-section">
      <header class="section-header-bar">
        <div>
          <h1 class="page-title">Gestión de Lotes y Vencimientos (FEFO / FIFO)</h1>
          <p class="page-subtitle">Las ventas descuentan automáticamente del lote que vence primero (FEFO) o del más antiguo (FIFO). Los lotes vencidos quedan bloqueados.</p>
        </div>
        <div class="header-actions-group">
          <button type="button" class="btn btn-primary" id="btn-create-lot-global">
            ${icon('plus', 15)}
            <span>Registrar Lote</span>
          </button>
        </div>
      </header>

      <div class="metrics-strip">
        <div class="metric-card">
          <span class="metric-label">Lotes Disponibles</span>
          <strong class="metric-val">${totalAvailableCount}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Próximos a Vencer (≤ 7 días)</span>
          <strong class="metric-val text-warning">${totalExpiringSoon}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Lotes Vencidos (Bloqueados)</span>
          <strong class="metric-val text-danger">${totalExpired}</strong>
        </div>
      </div>

      <div class="filter-toolbar">
        <select id="lot-filter-product" class="select-compact">
          <option value="ALL">Todos los productos</option>
          ${(st.products || [])
            .map(
              (p) => `<option value="${p.id}" ${prodFilter === p.id ? 'selected' : ''}>${escapeHTML(p.name)} (${escapeHTML(p.sku)})</option>`
            )
            .join('')}
        </select>

        <div class="segmented-filter">
          ${[
            { id: 'ALL', label: 'Todos' },
            { id: 'DISPONIBLE', label: 'Disponibles' },
            { id: 'PROXIMO_A_VENCER', label: 'Próximos a vencer' },
            { id: 'VENCIDO', label: 'Vencidos' },
            { id: 'AGOTADO', label: 'Agotados' },
          ]
            .map(
              (tab) => `
              <button
                type="button"
                class="filter-chip ${statusFilter === tab.id ? 'active' : ''}"
                data-lot-status="${tab.id}"
              >
                ${tab.label}
              </button>
            `
            )
            .join('')}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código Lote</th>
              <th>Producto</th>
              <th>Ingreso</th>
              <th>Vencimiento</th>
              <th class="num">Costo Unit.</th>
              <th class="num">Saldo Disponible</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function bindLotsViewEvents(root, refreshAll) {
  root.querySelector('#btn-create-lot-global')?.addEventListener('click', () => {
    openCreateLotModal(null, refreshAll)
  })

  root.querySelector('#lot-filter-product')?.addEventListener('change', (e) => {
    setState({ lotFilterProduct: e.target.value })
  })

  root.querySelectorAll('[data-lot-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ lotFilterStatus: btn.getAttribute('data-lot-status') })
    })
  })

  root.querySelectorAll('[data-lot-adjust]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lid = btn.getAttribute('data-lot-adjust')
      const lot = (getState().lots || []).find((l) => l.id === lid)
      if (lot) openAdjustLotModal(lot, refreshAll)
    })
  })
}

export function openCreateLotModal(preselectedProductId = null, refreshAll) {
  const st = getState()
  const products = st.products || []
  if (products.length === 0) {
    showToast('error', 'Primero debes crear al menos un producto.')
    return
  }

  const today = getTodayISO()
  const sugLot = `L-${today.replace(/-/g, '')}-${String((st.lots?.length || 0) + 1).padStart(2, '0')}`

  openDialog({
    title: 'Registrar Nuevo Lote de Inventario',
    subtitle: 'Ingresa las unidades recibidas, su fecha de entrada y fecha de vencimiento.',
    maxWidth: '520px',
    bodyHTML: `
      <form id="form-new-lot" class="form-stack">
        <div class="form-field">
          <label for="nl-product">Producto *</label>
          <select id="nl-product" required>
            ${products
              .map(
                (p) =>
                  `<option value="${p.id}" ${preselectedProductId === p.id ? 'selected' : ''}>${escapeHTML(p.name)} (${escapeHTML(p.sku)})</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-row-3">
          <div class="form-field">
            <label for="nl-code">Código de Lote *</label>
            <input id="nl-code" type="text" required value="${sugLot}" />
          </div>
          <div class="form-field">
            <label for="nl-qty">Cantidad Recibida *</label>
            <input id="nl-qty" type="number" step="0.001" min="0.001" required placeholder="Ej. 24" autofocus />
          </div>
          <div class="form-field">
            <label for="nl-cost">Costo Unitario (COP) *</label>
            <input id="nl-cost" type="number" step="any" min="0" required value="0" />
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-field">
            <label for="nl-entry">Fecha de Ingreso *</label>
            <input id="nl-entry" type="date" required value="${today}" />
          </div>
          <div class="form-field">
            <label for="nl-exp">Fecha de Vencimiento (opcional)</label>
            <input id="nl-exp" type="date" value="" />
          </div>
        </div>

        <div class="form-field">
          <label for="nl-notes">Observaciones / Proveedor</label>
          <input id="nl-notes" type="text" placeholder="Ej. Factura #4021 Distribuidora" />
        </div>

        <div id="nl-error" class="alert-error" hidden></div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Lote</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-new-lot')
      const errBox = modal.querySelector('#nl-error')
      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        errBox.hidden = true
        try {
          await createLotRequest({
            product_id: modal.querySelector('#nl-product').value,
            lot_number: modal.querySelector('#nl-code').value.trim(),
            quantity: Number(modal.querySelector('#nl-qty').value),
            unit_cost: Number(modal.querySelector('#nl-cost').value),
            entry_date: modal.querySelector('#nl-entry').value,
            expiration_date: modal.querySelector('#nl-exp').value || null,
            notes: modal.querySelector('#nl-notes').value.trim(),
          })
          closeDialog()
          await refreshAll()
          showToast('ok', 'Lote registrado y existencias actualizadas.')
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })
    },
  })
}

function openAdjustLotModal(lot, refreshAll) {
  openDialog({
    title: `Movimiento de Lote · ${escapeHTML(lot.lot_number)}`,
    subtitle: `${escapeHTML(lot.product_name)} · Saldo actual: ${formatQty(lot.available_quantity, lot.product_unit)}`,
    maxWidth: '500px',
    bodyHTML: `
      <form id="form-adjust-lot" class="form-stack">
        <div class="form-field">
          <label for="adj-op">Tipo de operación *</label>
          <select id="adj-op" required>
            <option value="ENTRADA_AJUSTE">Entrada adicional (+ sumar al lote)</option>
            <option value="SALIDA_MERMA">Salida por merma / avería (− restar al lote)</option>
            <option value="AJUSTE_DIRECTO">Definir saldo físico exacto (= reemplazar cantidad)</option>
          </select>
        </div>

        <div class="form-row-3">
          <div class="form-field">
            <label for="adj-qty">Cantidad *</label>
            <input id="adj-qty" type="number" step="0.001" min="0" required value="1" autofocus />
          </div>
          <div class="form-field">
            <label for="adj-cost">Costo Unitario (COP)</label>
            <input id="adj-cost" type="number" step="any" min="0" required value="${lot.unit_cost}" />
          </div>
          <div class="form-field">
            <label for="adj-exp">Fecha Vencimiento</label>
            <input id="adj-exp" type="date" value="${escapeHTML(lot.expiration_date || '')}" />
          </div>
        </div>

        <div class="form-field">
          <label for="adj-reason">Motivo del movimiento (auditoría) *</label>
          <input id="adj-reason" type="text" required minlength="3" placeholder="Ej. Conteo físico de inventario / Baja por rotura" />
        </div>

        <div id="adj-error" class="alert-error" hidden></div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar Movimiento</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-adjust-lot')
      const errBox = modal.querySelector('#adj-error')
      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        errBox.hidden = true
        try {
          await adjustLotRequest(lot.id, {
            operation: modal.querySelector('#adj-op').value,
            quantity: Number(modal.querySelector('#adj-qty').value),
            unit_cost: Number(modal.querySelector('#adj-cost').value),
            expiration_date: modal.querySelector('#adj-exp').value || null,
            reason: modal.querySelector('#adj-reason').value.trim(),
          })
          closeDialog()
          await refreshAll()
          showToast('ok', 'Movimiento de inventario registrado.')
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })
    },
  })
}

// =============================================================================
// 3. GESTIÓN DE INVENTARIO Y TRAZABILIDAD (KARDEX)
// =============================================================================

export function renderInventoryViewHTML(st) {
  if (!isOwner(st.user)) return ''

  const products = st.products || []
  const outOfStock = products.filter((p) => p.is_active && p.available_stock <= 0)
  const lowStock = products.filter((p) => p.is_active && p.available_stock > 0 && p.is_low_stock)
  const movements = st.movements || []

  const movRows =
    movements.length === 0
      ? `<tr><td colspan="7" class="empty-cell">No se han registrado movimientos de inventario aún.</td></tr>`
      : movements
          .map((m) => {
            const dt = new Date(m.created_at).toLocaleString('es-CO', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
            const isPositive = Number(m.quantity) > 0
            return `
              <tr>
                <td>${escapeHTML(dt)}</td>
                <td><span class="status-badge badge-neutral">${escapeHTML(m.movement_type)}</span></td>
                <td>
                  <strong>${escapeHTML(m.product_name)}</strong>
                  <div class="cell-sub">${escapeHTML(m.product_sku)}</div>
                </td>
                <td class="mono">${escapeHTML(m.lot_number || '—')}</td>
                <td class="num ${isPositive ? 'text-success' : 'text-danger'}">
                  <strong>${isPositive ? `+${m.quantity}` : m.quantity} ${escapeHTML(m.product_unit)}</strong>
                </td>
                <td class="num">${m.previous_stock} → <strong>${m.new_stock}</strong></td>
                <td>
                  <div>${escapeHTML(m.reason)}</div>
                  <div class="cell-sub">Responsable: ${escapeHTML(m.user_name)}</div>
                </td>
              </tr>
            `
          })
          .join('')

  return `
    <section class="admin-section">
      <header class="section-header-bar">
        <div>
          <h1 class="page-title">Inventario y Kardex de Movimientos</h1>
          <p class="page-subtitle">Monitoreo de productos agotados, existencias bajas y trazabilidad completa de entradas y salidas.</p>
        </div>
        <div class="header-actions-group">
          <button type="button" class="btn btn-primary" id="btn-inv-new-lot">
            ${icon('plus', 15)}
            <span>Registrar Entrada (Lote)</span>
          </button>
        </div>
      </header>

      <div class="metrics-strip">
        <div class="metric-card">
          <span class="metric-label">Productos Activos</span>
          <strong class="metric-val">${products.filter((p) => p.is_active).length}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Con Existencias Bajas</span>
          <strong class="metric-val text-warning">${lowStock.length}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Productos Agotados</span>
          <strong class="metric-val text-danger">${outOfStock.length}</strong>
        </div>
      </div>

      ${
        outOfStock.length > 0 || lowStock.length > 0
          ? `
        <div class="alerts-grid">
          ${outOfStock
            .map(
              (p) => `
              <div class="stock-alert-card alert-critical">
                <div>
                  <span class="status-badge badge-danger">AGOTADO</span>
                  <strong>${escapeHTML(p.name)}</strong>
                  <small>SKU: ${escapeHTML(p.sku)} · Mínimo requerido: ${p.min_stock} ${escapeHTML(p.unit)}</small>
                </div>
                <button type="button" class="btn btn-outline btn-xs" data-inv-restock="${p.id}">+ Ingresar Lote</button>
              </div>
            `
            )
            .join('')}
          ${lowStock
            .map(
              (p) => `
              <div class="stock-alert-card alert-low">
                <div>
                  <span class="status-badge badge-warning">STOCK BAJO (${p.available_stock} ${escapeHTML(p.unit)})</span>
                  <strong>${escapeHTML(p.name)}</strong>
                  <small>SKU: ${escapeHTML(p.sku)} · Mínimo requerido: ${p.min_stock} ${escapeHTML(p.unit)}</small>
                </div>
                <button type="button" class="btn btn-outline btn-xs" data-inv-restock="${p.id}">+ Ingresar Lote</button>
              </div>
            `
            )
            .join('')}
        </div>
      `
          : ''
      }

      <h2 class="subsection-title">Historial de Movimientos (Kardex)</h2>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Operación</th>
              <th>Producto</th>
              <th>Lote</th>
              <th class="num">Variación</th>
              <th class="num">Saldo Lote</th>
              <th>Motivo y Usuario</th>
            </tr>
          </thead>
          <tbody>
            ${movRows}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function bindInventoryViewEvents(root, refreshAll) {
  root.querySelector('#btn-inv-new-lot')?.addEventListener('click', () => {
    openCreateLotModal(null, refreshAll)
  })

  root.querySelectorAll('[data-inv-restock]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openCreateLotModal(btn.getAttribute('data-inv-restock'), refreshAll)
    })
  })
}

// =============================================================================
// 4. HISTORIAL DE VENTAS Y FILTROS (EXCLUSIVO DUEÑO)
// =============================================================================

export function renderSalesViewHTML(st) {
  if (!isOwner(st.user)) return ''

  const sales = st.sales || []
  const summary = st.salesSummary || { count: 0, grand_total: 0, by_payment_method: {} }
  const byMethod = summary.by_payment_method || {}

  const rowsHTML =
    sales.length === 0
      ? `<tr><td colspan="7" class="empty-cell">No se encontraron ventas para los filtros seleccionados.</td></tr>`
      : sales
          .map((s) => {
            const dt = new Date(s.created_at).toLocaleString('es-CO', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
            const itemsSummary = (s.items || [])
              .map((i) => `${escapeHTML(i.product_name)} (×${i.quantity})`)
              .join(', ')
            return `
              <tr>
                <td class="mono"><strong>${escapeHTML(s.folio)}</strong></td>
                <td>${escapeHTML(dt)}</td>
                <td>${escapeHTML(s.seller_name)} <span class="text-muted">(@${escapeHTML(s.seller_username)})</span></td>
                <td><span class="status-badge badge-neutral">${escapeHTML(s.payment_method_name)}</span></td>
                <td class="cell-truncate" title="${escapeHTML(itemsSummary)}">${escapeHTML(itemsSummary)}</td>
                <td class="num"><strong>${formatCOP(s.total)}</strong></td>
                <td class="actions-cell">
                  <button type="button" class="btn btn-outline btn-xs" data-sale-receipt="${s.id}">
                    ${icon('printer', 12)} Comprobante
                  </button>
                </td>
              </tr>
            `
          })
          .join('')

  return `
    <section class="admin-section">
      <header class="section-header-bar">
        <div>
          <h1 class="page-title">Registro e Historial de Ventas</h1>
          <p class="page-subtitle">Auditoría de transacciones, desglose por medios de pago y filtros por fecha, producto y vendedor.</p>
        </div>
      </header>

      <div class="metrics-strip">
        <div class="metric-card">
          <span class="metric-label">Total Ventas Filtradas (${summary.count})</span>
          <strong class="metric-val">${formatCOP(summary.grand_total)}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Efectivo</span>
          <strong class="metric-val">${formatCOP(byMethod.efectivo || 0)}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Nequi</span>
          <strong class="metric-val">${formatCOP(byMethod.nequi || 0)}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Daviplata</span>
          <strong class="metric-val">${formatCOP(byMethod.daviplata || 0)}</strong>
        </div>
      </div>

      <form id="sales-filter-form" class="filter-toolbar">
        <div class="form-field compact">
          <label for="sf-from">Desde</label>
          <input id="sf-from" type="date" value="${escapeHTML(st.salesFilterFrom)}" />
        </div>
        <div class="form-field compact">
          <label for="sf-to">Hasta</label>
          <input id="sf-to" type="date" value="${escapeHTML(st.salesFilterTo)}" />
        </div>
        <div class="form-field compact">
          <label for="sf-user">Vendedor</label>
          <select id="sf-user">
            <option value="">Todos los usuarios</option>
            ${(st.users || [])
              .map(
                (u) => `<option value="${u.id}" ${st.salesFilterUser === u.id ? 'selected' : ''}>${escapeHTML(u.full_name)}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="form-field compact">
          <label for="sf-prod">Producto</label>
          <select id="sf-prod">
            <option value="">Todos los productos</option>
            ${(st.products || [])
              .map(
                (p) => `<option value="${p.id}" ${st.salesFilterProduct === p.id ? 'selected' : ''}>${escapeHTML(p.name)}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="form-field compact">
          <label for="sf-method">Método de Pago</label>
          <select id="sf-method">
            <option value="">Todos</option>
            <option value="efectivo" ${st.salesFilterMethod === 'efectivo' ? 'selected' : ''}>Efectivo</option>
            <option value="nequi" ${st.salesFilterMethod === 'nequi' ? 'selected' : ''}>Nequi</option>
            <option value="daviplata" ${st.salesFilterMethod === 'daviplata' ? 'selected' : ''}>Daviplata</option>
          </select>
        </div>
        <div class="filter-actions">
          <button type="submit" class="btn btn-primary btn-sm">Aplicar Filtros</button>
          <button type="button" id="btn-sales-clear-filters" class="btn btn-ghost btn-sm">Limpiar</button>
        </div>
      </form>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha y Hora</th>
              <th>Vendedor</th>
              <th>Método</th>
              <th>Artículos Vendidos</th>
              <th class="num">Total</th>
              <th>Comprobante</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function bindSalesViewEvents(root) {
  const form = root.querySelector('#sales-filter-form')
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const filters = {
      date_from: root.querySelector('#sf-from').value,
      date_to: root.querySelector('#sf-to').value,
      user_id: root.querySelector('#sf-user').value,
      product_id: root.querySelector('#sf-prod').value,
      payment_method: root.querySelector('#sf-method').value,
    }
    try {
      const res = await fetchSales(filters)
      setState({
        salesFilterFrom: filters.date_from,
        salesFilterTo: filters.date_to,
        salesFilterUser: filters.user_id,
        salesFilterProduct: filters.product_id,
        salesFilterMethod: filters.payment_method,
        sales: res.sales || [],
        salesSummary: res.summary,
      })
    } catch (err) {
      showToast('error', err.message)
    }
  })

  root.querySelector('#btn-sales-clear-filters')?.addEventListener('click', async () => {
    try {
      const res = await fetchSales({})
      setState({
        salesFilterFrom: '',
        salesFilterTo: '',
        salesFilterUser: '',
        salesFilterProduct: '',
        salesFilterMethod: '',
        sales: res.sales || [],
        salesSummary: res.summary,
      })
    } catch (err) {
      showToast('error', err.message)
    }
  })

  root.querySelectorAll('[data-sale-receipt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sid = btn.getAttribute('data-sale-receipt')
      const sale = (getState().sales || []).find((s) => s.id === sid)
      if (sale) openSaleReceiptModal(sale)
    })
  })
}

// =============================================================================
// 5. ADMINISTRACIÓN DE USUARIOS Y ROLES (EXCLUSIVO DUEÑO)
// =============================================================================

export function renderUsersViewHTML(st) {
  if (!isOwner(st.user)) return ''

  const users = st.users || []
  const rowsHTML = users
    .map((u) => {
      const dt = new Date(u.created_at).toLocaleDateString('es-CO')
      return `
        <tr class="${!u.is_active ? 'row-inactive' : ''}">
          <td><strong>${escapeHTML(u.full_name)}</strong></td>
          <td class="mono">@${escapeHTML(u.username)}</td>
          <td>
            <span class="status-badge ${u.role === 'dueno' ? 'badge-accent' : 'badge-neutral'}">
              ${escapeHTML(u.role_name)}
            </span>
          </td>
          <td>
            <span class="status-badge ${u.is_active ? 'badge-success' : 'badge-danger'}">
              ${u.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="num">${u.total_sales_count || 0}</td>
          <td>${escapeHTML(dt)}</td>
          <td class="actions-cell">
            <button type="button" class="btn btn-outline btn-xs" data-user-edit="${u.id}">
              ${icon('edit', 12)} Editar / Permisos
            </button>
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <section class="admin-section">
      <header class="section-header-bar">
        <div>
          <h1 class="page-title">Usuarios y Control de Acceso</h1>
          <p class="page-subtitle">Administra las cuentas operativas de Tenderos y Dueños. Las cuentas inactivas tienen el inicio de sesión revocado inmediatamente.</p>
        </div>
        <div class="header-actions-group">
          <button type="button" class="btn btn-primary" id="btn-new-user">
            ${icon('plus', 15)}
            <span>Crear Usuario</span>
          </button>
        </div>
      </header>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Usuario</th>
              <th>Rol Asignado</th>
              <th>Estado</th>
              <th class="num">Ventas Registradas</th>
              <th>Fecha Alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    </section>
  `
}

export function bindUsersViewEvents(root, refreshAll) {
  root.querySelector('#btn-new-user')?.addEventListener('click', () => {
    openUserFormModal(null, refreshAll)
  })

  root.querySelectorAll('[data-user-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-user-edit')
      const target = (getState().users || []).find((u) => u.id === uid)
      if (target) openUserFormModal(target, refreshAll)
    })
  })
}

function openUserFormModal(targetUser = null, refreshAll) {
  const isEdit = Boolean(targetUser)

  openDialog({
    title: isEdit ? `Editar Usuario · @${escapeHTML(targetUser.username)}` : 'Crear Nuevo Usuario',
    subtitle: isEdit
      ? 'Modifica el rol, estado de acceso o restablece la contraseña.'
      : 'Crea una cuenta autorizada de Tendero (solo POS) o Dueño.',
    maxWidth: '480px',
    bodyHTML: `
      <form id="form-user" class="form-stack" autocomplete="off">
        <div class="form-field">
          <label for="u-fullname">Nombre completo *</label>
          <input id="u-fullname" type="text" required minlength="2" value="${escapeHTML(targetUser?.full_name || '')}" placeholder="Ej. Laura Gómez" autofocus />
        </div>

        ${
          !isEdit
            ? `
          <div class="form-field">
            <label for="u-username">Nombre de usuario (sin espacios) *</label>
            <input id="u-username" type="text" required minlength="3" placeholder="Ej. lgomez" />
          </div>
        `
            : ''
        }

        <div class="form-row-2">
          <div class="form-field">
            <label for="u-role">Rol operativo *</label>
            <select id="u-role" required>
              <option value="tendero" ${targetUser?.role === 'tendero' ? 'selected' : ''}>Tendero (Solo Punto de Venta)</option>
              <option value="dueno" ${targetUser?.role === 'dueno' ? 'selected' : ''}>Dueño (Administración Total)</option>
            </select>
          </div>

          ${
            isEdit
              ? `
            <div class="form-field">
              <label for="u-active">Estado de la cuenta</label>
              <select id="u-active">
                <option value="1" ${targetUser.is_active ? 'selected' : ''}>Activo (Acceso permitido)</option>
                <option value="0" ${!targetUser.is_active ? 'selected' : ''}>Inactivo (Acceso bloqueado)</option>
              </select>
            </div>
          `
              : ''
          }
        </div>

        <div class="form-field">
          <label for="u-password">${isEdit ? 'Nueva contraseña (dejar vacío para conservar actual)' : 'Contraseña (mínimo 8 caracteres) *'}</label>
          <input id="u-password" type="password" ${isEdit ? '' : 'required'} minlength="8" placeholder="••••••••" />
        </div>

        <div id="u-error" class="alert-error" hidden></div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Cuenta'}</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-user')
      const errBox = modal.querySelector('#u-error')

      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        errBox.hidden = true
        try {
          if (isEdit) {
            const payload = {
              full_name: modal.querySelector('#u-fullname').value.trim(),
              role: modal.querySelector('#u-role').value,
              is_active: modal.querySelector('#u-active').value === '1',
            }
            const pwd = modal.querySelector('#u-password').value
            if (pwd) payload.password = pwd
            await updateUserRequest(targetUser.id, payload)
            showToast('ok', `Usuario @${targetUser.username} actualizado.`)
          } else {
            await createUserRequest({
              full_name: modal.querySelector('#u-fullname').value.trim(),
              username: modal.querySelector('#u-username').value.trim(),
              role: modal.querySelector('#u-role').value,
              password: modal.querySelector('#u-password').value,
            })
            showToast('ok', 'Cuenta de usuario creada correctamente.')
          }
          closeDialog()
          await refreshAll()
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })
    },
  })
}
