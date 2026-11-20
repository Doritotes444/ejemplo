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
import {
  PRODUCT_COLOR_PALETTE,
  buildAestheticFallbackSVG,
  generateUniqueSKU,
} from '../core/localStore.js'
import { formatCOP } from '../utils/money.js'
import { formatQty, isBulkUnit } from '../utils/quantities.js'
import { getTodayISO } from '../utils/validation.js'
import { icon } from './icons.js'
import { openDialog, closeDialog } from './dialog.js'
import { openSaleReceiptModal } from './receipt.js'

const UNITS = [
  { code: 'und', label: 'Unidad (und)' },
  { code: 'kg', label: 'Kilogramo (kg · fraccionable)' },
  { code: 'lb', label: 'Libra (lb · fraccionable)' },
  { code: 'lt', label: 'Litro (lt · fraccionable)' },
  { code: 'gr', label: 'Gramo (gr · fraccionable)' },
  { code: 'caja', label: 'Caja (entero)' },
]

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function computeMarginStats(salePrice, unitCost) {
  const price = Number(salePrice)
  const cost = Number(unitCost)
  if (!Number.isFinite(price) || price <= 0) {
    return { status: 'empty', text: 'Ingresa el precio de venta para calcular margen.' }
  }
  if (!Number.isFinite(cost) || cost <= 0) {
    return {
      status: 'warn',
      text: 'Sin costo registrado (opcional, pero recomendado para ver tu ganancia real).',
    }
  }
  const profit = price - cost
  const pct = Math.round((profit / price) * 100)
  if (profit < 0) {
    return {
      status: 'danger',
      text: `Margen negativo: pierdes ${formatCOP(Math.abs(profit))} por unidad (${pct}%).`,
    }
  }
  if (profit === 0) {
    return {
      status: 'warn',
      text: 'Precio igual al costo: ganancia $0 (0%).',
    }
  }
  return {
    status: 'ok',
    text: `Ganancia estimada: ${formatCOP(profit)} por unidad (${pct}% margen).`,
  }
}

function compressImageFileToDataURL(file, maxSize = 240) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecciona una imagen válida (JPG, PNG o WebP).'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('La imagen supera los 5 MB. Elige un archivo más liviano.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'))
    reader.readAsDataURL(file)
  })
}

// =============================================================================
// 1. GESTIÓN DE PRODUCTOS Y CATEGORÍAS
// =============================================================================

export function renderProductsViewHTML(st) {
  if (!isOwner(st.user)) return ''

  const allProducts = st.products || []
  const q = String(st.productSearch || '').trim().toLowerCase()
  const catFilter = st.productCategoryFilter || 'ALL'
  const stockFilter = st.productStockFilter || 'ALL'
  const showInactive = Boolean(st.productShowInactive)

  const lowStockCount = allProducts.filter(
    (p) => p.is_active && Number(p.available_stock || 0) > 0 && p.is_low_stock
  ).length
  const outStockCount = allProducts.filter(
    (p) => p.is_active && Number(p.available_stock || 0) <= 0
  ).length
  const expiringCount = allProducts.filter(
    (p) => p.is_active && Number(p.expiring_soon_count || 0) > 0
  ).length

  const filtered = allProducts.filter((p) => {
    if (!showInactive && !p.is_active) return false
    if (catFilter !== 'ALL' && String(p.category_id || '') !== String(catFilter)) return false
    const avail = Number(p.available_stock || 0)
    if (stockFilter === 'LOW' && !(avail > 0 && p.is_low_stock)) return false
    if (stockFilter === 'OUT' && avail > 0) return false
    if (stockFilter === 'EXPIRING' && !(Number(p.expiring_soon_count || 0) > 0)) return false
    if (!q) return true
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    )
  })

  const rowsHTML =
    filtered.length === 0
      ? `<tr><td colspan="7" class="empty-cell">
          <p class="empty-title">${allProducts.length === 0 ? 'Aún no tienes productos en el catálogo' : 'No hay productos que coincidan con el filtro'}</p>
          <p class="empty-subtitle">${allProducts.length === 0 ? 'Usa "+ Nuevo Producto" para registrar tu primer artículo en segundos.' : 'Prueba limpiando el buscador o cambiando el filtro de categoría o stock.'}</p>
        </td></tr>`
      : filtered
          .map((p) => {
            const avail = Number(p.available_stock || 0)
            let stockBadge = `<span class="status-badge badge-success">${formatQty(avail, p.unit)}</span>`
            if (avail <= 0) {
              stockBadge = `<span class="status-badge badge-danger">Agotado (0)</span>`
            } else if (p.is_low_stock) {
              stockBadge = `<span class="status-badge badge-warning">Bajo (${formatQty(avail, p.unit)})</span>`
            }

            const imgSrc =
              p.image_url || buildAestheticFallbackSVG(p.name, p.sku, p.color_tag || 'slate')
            const hasCost = Number(p.unit_cost || 0) > 0
            const marginPct =
              hasCost && Number(p.sale_price) > 0
                ? Math.round(((Number(p.sale_price) - Number(p.unit_cost)) / Number(p.sale_price)) * 100)
                : null

            return `
              <tr class="${!p.is_active ? 'row-inactive' : ''}">
                <td class="mono">
                  <strong>${escapeHTML(p.sku)}</strong>
                  ${p.barcode ? `<div class="cell-sub">${escapeHTML(p.barcode)}</div>` : '<div class="cell-sub">Sin EAN</div>'}
                </td>
                <td>
                  <div class="table-prod-cell">
                    <img
                      src="${escapeHTML(imgSrc)}"
                      alt="${escapeHTML(p.name)}"
                      class="table-prod-thumb"
                      data-sku="${escapeHTML(p.sku)}"
                      data-color="${escapeHTML(p.color_tag || 'slate')}"
                      onerror="window.handleProductImageError && window.handleProductImageError(this)"
                    />
                    <div class="table-prod-info">
                      <strong>${escapeHTML(p.name)}</strong>
                      ${p.description ? `<div class="cell-sub cell-truncate" title="${escapeHTML(p.description)}">${escapeHTML(p.description)}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td>${escapeHTML(p.category_name || 'Sin categoría')}</td>
                <td class="num">
                  <strong>${formatCOP(p.sale_price)}</strong> <small class="text-muted">/ ${escapeHTML(p.unit)}</small>
                  ${
                    hasCost
                      ? `<div class="cell-sub">Costo ${formatCOP(p.unit_cost)} · <span class="${marginPct < 0 ? 'text-danger' : 'text-success'}">${marginPct}%</span></div>`
                      : ''
                  }
                </td>
                <td>
                  ${stockBadge}
                  <div class="cell-sub">Mínimo: ${p.min_stock} ${escapeHTML(p.unit)}${p.expiring_soon_count ? ` · <span class="text-warning">${p.expiring_soon_count} lote(s) por vencer</span>` : ''}</div>
                </td>
                <td>
                  <span class="status-badge ${p.is_active ? 'badge-neutral' : 'badge-danger'}">
                    ${p.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="actions-cell">
                  <button type="button" class="btn btn-outline btn-xs" data-prod-add-lot="${p.id}" title="Ingresar lote de mercancía">
                    ${icon('plus', 12)} Lote
                  </button>
                  <button type="button" class="btn btn-outline btn-xs" data-prod-edit="${p.id}" title="Editar información comercial">
                    ${icon('edit', 12)} Editar
                  </button>
                  <button type="button" class="btn btn-ghost btn-xs" data-prod-duplicate="${p.id}" title="Duplicar producto para crear otra presentación">
                    ${icon('copy', 12)}
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
          <p class="page-subtitle">Crea productos rápido con nombre y precio; controla SKU, costos, unidades fraccionables y lotes FEFO.</p>
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
        <select id="prod-cat-select" class="select-compact" aria-label="Filtrar por categoría">
          <option value="ALL">Todas las categorías</option>
          ${(st.categories || [])
            .map(
              (c) => `<option value="${c.id}" ${String(st.productCategoryFilter) === String(c.id) ? 'selected' : ''}>${escapeHTML(c.name)}</option>`
            )
            .join('')}
        </select>
        <label class="checkbox-inline">
          <input id="prod-show-inactive" type="checkbox" ${st.productShowInactive ? 'checked' : ''} />
          <span>Mostrar inactivos</span>
        </label>
      </div>

      <div class="stock-filter-bar" role="tablist" aria-label="Filtrar por estado de existencias">
        <button type="button" class="filter-chip ${stockFilter === 'ALL' ? 'active' : ''}" data-prod-stock="ALL">
          Todos (${allProducts.length})
        </button>
        <button type="button" class="filter-chip ${stockFilter === 'LOW' ? 'active' : ''}" data-prod-stock="LOW">
          Stock bajo (${lowStockCount})
        </button>
        <button type="button" class="filter-chip ${stockFilter === 'OUT' ? 'active' : ''}" data-prod-stock="OUT">
          Agotados (${outStockCount})
        </button>
        <button type="button" class="filter-chip ${stockFilter === 'EXPIRING' ? 'active' : ''}" data-prod-stock="EXPIRING">
          Por vencer (${expiringCount})
        </button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU / Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th class="num">Precio / Costo</th>
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
    const pos = e.target.selectionStart
    setState({ productSearch: e.target.value })
    const el = document.querySelector('#prod-search-input')
    if (el) {
      el.focus()
      const caret = pos != null ? pos : el.value.length
      el.setSelectionRange(caret, caret)
    }
  })

  root.querySelector('#prod-cat-select')?.addEventListener('change', (e) => {
    setState({ productCategoryFilter: e.target.value })
  })

  root.querySelector('#prod-show-inactive')?.addEventListener('change', (e) => {
    setState({ productShowInactive: e.target.checked })
  })

  root.querySelectorAll('[data-prod-stock]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ productStockFilter: btn.getAttribute('data-prod-stock') || 'ALL' })
    })
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

  root.querySelectorAll('[data-prod-duplicate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-prod-duplicate')
      const prod = getState().products.find((p) => p.id === pid)
      if (prod) {
        openProductFormModal(null, refreshAll, { duplicateFrom: prod })
      }
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
  if (!isOwner(getState().user)) {
    showToast('error', 'Solo el Dueño puede crear categorías.')
    return
  }
  openDialog({
    title: 'Nueva Categoría',
    subtitle: 'Organiza el catálogo de productos para agilizar búsquedas y filtros.',
    maxWidth: '420px',
    bodyHTML: `
      <form id="form-category" class="form-stack" novalidate>
        <div class="form-field">
          <label for="cat-name">Nombre de la categoría *</label>
          <input id="cat-name" type="text" required minlength="2" placeholder="Ej. Panadería" autofocus />
        </div>
        <div class="form-field">
          <label for="cat-desc">Descripción (opcional)</label>
          <input id="cat-desc" type="text" placeholder="Productos horneados y frescos" />
        </div>
        <div id="cat-error" class="alert-error" role="alert" hidden></div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-save-category">Guardar Categoría</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-category')
      const errBox = modal.querySelector('#cat-error')
      const saveBtn = modal.querySelector('#btn-save-category')
      let saving = false
      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (saving) return
        errBox.hidden = true
        const nameVal = modal.querySelector('#cat-name').value.trim()
        if (nameVal.length < 2) {
          errBox.textContent = 'Escribe un nombre de al menos 2 caracteres.'
          errBox.hidden = false
          modal.querySelector('#cat-name').focus()
          return
        }
        saving = true
        if (saveBtn) {
          saveBtn.disabled = true
          saveBtn.textContent = 'Guardando...'
        }
        try {
          await createCategoryRequest({
            name: nameVal,
            description: modal.querySelector('#cat-desc').value.trim(),
          })
          closeDialog()
          await refreshAll()
          showToast('ok', 'Categoría registrada correctamente.')
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
          saving = false
          if (saveBtn) {
            saveBtn.disabled = false
            saveBtn.textContent = 'Guardar Categoría'
          }
        }
      })
    },
  })
}

export function openProductFormModal(product = null, refreshAll, options = {}) {
  const st = getState()
  if (!isOwner(st.user)) {
    showToast('error', 'Permiso denegado: solo el Dueño puede crear o editar productos.')
    return
  }

  const isEdit = Boolean(product)
  const dup = !isEdit ? options.duplicateFrom || null : null
  const seed = product || dup || null
  const today = getTodayISO()

  const initialName = isEdit
    ? product.name || ''
    : dup
      ? `${dup.name} (Copia)`
      : ''
  const initialSku = isEdit ? product.sku || '' : ''
  const initialBarcode = isEdit ? product.barcode || '' : ''
  const initialUnit = seed?.unit || 'und'
  const initialCategoryId = seed?.category_id ? String(seed.category_id) : ''
  const initialPrice = seed?.sale_price ?? ''
  const initialCost = seed?.unit_cost ?? ''
  const initialMinStock = seed?.min_stock ?? 5
  const initialDesc = seed?.description || ''
  const initialColor = seed?.color_tag || 'slate'
  const initialImage = seed?.image_url || ''
  const previewSrc =
    initialImage || buildAestheticFallbackSVG(initialName || 'Producto', initialSku || 'AUTO', initialColor)

  const initialMargin = computeMarginStats(initialPrice, initialCost)

  openDialog({
    title: isEdit
      ? `Editar Producto · ${escapeHTML(product.sku)}`
      : dup
        ? 'Duplicar Producto'
        : 'Nuevo Producto',
    subtitle: isEdit
      ? 'Actualiza los datos comerciales sin alterar ventas históricas ni lotes registrados.'
      : 'Alta rápida: solo Nombre y Precio son obligatorios. Los detalles de lote, código e imagen son opcionales.',
    maxWidth: '620px',
    bodyHTML: `
      <form id="form-product" class="form-stack product-form-modern" novalidate>
        <!-- SECCIÓN 1: ALTA RÁPIDA (ESENCIALES) -->
        <div class="pf-section-card">
          <div class="pf-section-header">
            <span class="pf-step-label">Datos esenciales</span>
            <span class="pf-required-hint">* Obligatorios para guardar</span>
          </div>

          <div class="form-field">
            <label for="p-name">Nombre del producto *</label>
            <input
              id="p-name"
              type="text"
              required
              minlength="2"
              value="${escapeHTML(initialName)}"
              placeholder="Ej. Café Molido Águila Roja 500g"
              autocomplete="off"
              autofocus
            />
            <span class="field-error" id="err-p-name" hidden></span>
          </div>

          <div class="form-row-2">
            <div class="form-field">
              <label for="p-price">Precio de venta (COP) *</label>
              <div class="input-prefix-wrap">
                <span class="input-prefix">$</span>
                <input
                  id="p-price"
                  type="number"
                  inputmode="decimal"
                  step="any"
                  min="1"
                  required
                  value="${escapeHTML(initialPrice)}"
                  placeholder="Ej. 14500"
                />
              </div>
              <span class="field-error" id="err-p-price" hidden></span>
            </div>

            <div class="form-field">
              <label for="p-cost">Costo unitario (COP) <span class="label-opt">(opcional)</span></label>
              <div class="input-prefix-wrap">
                <span class="input-prefix">$</span>
                <input
                  id="p-cost"
                  type="number"
                  inputmode="decimal"
                  step="any"
                  min="0"
                  value="${escapeHTML(initialCost)}"
                  placeholder="Ej. 10200"
                />
              </div>
              <span class="field-error" id="err-p-cost" hidden></span>
            </div>
          </div>

          <div id="pf-margin-pill" class="pf-margin-pill margin-${initialMargin.status}" aria-live="polite">
            ${escapeHTML(initialMargin.text)}
          </div>

          <div class="form-row-2">
            <div class="form-field">
              <label for="p-unit">Se vende por (unidad)</label>
              <select id="p-unit">
                ${UNITS.map(
                  (u) => `<option value="${u.code}" ${initialUnit === u.code ? 'selected' : ''}>${u.label}</option>`
                ).join('')}
              </select>
              <span class="field-hint" id="pf-unit-hint">
                ${isBulkUnit(initialUnit) ? 'Permite cantidades decimales en el POS (ej. 0.5).' : 'Se vende en unidades enteras en el POS.'}
              </span>
            </div>

            <div class="form-field">
              <div class="label-with-action">
                <label for="p-cat">Categoría</label>
                <button type="button" class="btn-link-xs" id="btn-inline-new-cat">+ Nueva categoría</button>
              </div>
              <select id="p-cat">
                <option value="">Sin categoría</option>
                ${(st.categories || [])
                  .map(
                    (c) =>
                      `<option value="${escapeHTML(c.id)}" ${initialCategoryId === String(c.id) ? 'selected' : ''}>${escapeHTML(c.name)}</option>`
                  )
                  .join('')}
              </select>
            </div>
          </div>

          <div id="inline-cat-box" class="inline-cat-box" hidden>
            <input id="inline-cat-name" type="text" placeholder="Nombre de la nueva categoría..." />
            <button type="button" class="btn btn-primary btn-sm" id="btn-inline-cat-save">Agregar</button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-inline-cat-cancel">Cancelar</button>
          </div>

          ${
            !isEdit
              ? `
            <div class="pf-quick-stock-row">
              <div class="form-field">
                <label for="p-lot-qty">Stock inicial <span class="label-opt">(opcional · crea 1er lote FEFO)</span></label>
                <input
                  id="p-lot-qty"
                  type="number"
                  inputmode="decimal"
                  step="${isBulkUnit(initialUnit) ? '0.001' : '1'}"
                  min="0"
                  value=""
                  placeholder="0 (sin existencias iniciales aún)"
                />
                <span class="field-hint">Déjalo vacío o en 0 si ingresarás lotes después. Si pones más de 0, queda listo para vender.</span>
                <span class="field-error" id="err-p-lot-qty" hidden></span>
              </div>
              <div class="form-field">
                <label for="p-lot-exp">Vencimiento del lote <span class="label-opt">(opcional)</span></label>
                <input id="p-lot-exp" type="date" value="" />
                <span class="field-hint">Solo para productos perecederos (control FEFO).</span>
              </div>
            </div>
          `
              : `
            <div class="pf-edit-stock-summary">
              <div>
                <span class="pf-step-label">Inventario actual (controlado por lotes)</span>
                <div class="pf-stock-readout">
                  <strong>${formatQty(product.available_stock || 0, product.unit)}</strong>
                  <span>en ${product.active_lots_count || 0} lote(s) vigentes · mínimo ${product.min_stock} ${escapeHTML(product.unit)}</span>
                </div>
              </div>
              <button type="button" class="btn btn-outline btn-xs" id="btn-edit-add-lot">
                ${icon('plus', 12)} Ingresar Lote
              </button>
            </div>
          `
          }
        </div>

        <!-- SECCIÓN 2: CAMPOS SECUNDARIOS COLAPSABLES -->
        <details id="pf-secondary-details" class="pf-details-box" ${isEdit ? '' : ''}>
          <summary class="pf-details-summary">
            <span>Códigos (SKU / Barras), stock mínimo, lote e imagen</span>
            <span class="pf-details-chevron">${icon('chevronDown', 15)}</span>
          </summary>

          <div class="pf-details-content">
            <div class="form-row-2">
              <div class="form-field">
                <div class="label-with-action">
                  <label for="p-sku">Código SKU ${isEdit ? '*' : '<span class="label-opt">(auto si queda vacío)</span>'}</label>
                  ${!isEdit ? `<button type="button" class="btn-link-xs" id="btn-auto-sku">Sugerir SKU</button>` : ''}
                </div>
                <input
                  id="p-sku"
                  type="text"
                  value="${escapeHTML(initialSku)}"
                  placeholder="Automático al guardar (ej. CAF-001)"
                  autocomplete="off"
                />
                <span class="field-error" id="err-p-sku" hidden></span>
              </div>

              <div class="form-field">
                <label for="p-barcode">Código de barras (EAN / UPC)</label>
                <input
                  id="p-barcode"
                  type="text"
                  value="${escapeHTML(initialBarcode)}"
                  placeholder="Ej. 7702001099012"
                  autocomplete="off"
                />
                <span class="field-error" id="err-p-barcode" hidden></span>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-field">
                <label for="p-min">Alerta de stock mínimo</label>
                <input
                  id="p-min"
                  type="number"
                  inputmode="decimal"
                  step="0.001"
                  min="0"
                  value="${escapeHTML(initialMinStock)}"
                />
                <span class="field-error" id="err-p-min" hidden></span>
              </div>

              ${
                !isEdit
                  ? `
                <div class="form-field">
                  <label for="p-lot-num">N.° de lote inicial</label>
                  <input id="p-lot-num" type="text" value="L-${today.replace(/-/g, '')}-01" />
                </div>
              `
                  : `
                <div class="form-field">
                  <label for="p-desc">Nota / Descripción breve</label>
                  <input id="p-desc" type="text" value="${escapeHTML(initialDesc)}" placeholder="Ej. Presentación familiar, proveedor..." />
                </div>
              `
              }
            </div>

            ${
              !isEdit
                ? `
              <div class="form-row-2">
                <div class="form-field">
                  <label for="p-lot-entry">Fecha de ingreso del lote</label>
                  <input id="p-lot-entry" type="date" value="${today}" />
                </div>
                <div class="form-field">
                  <label for="p-desc">Nota / Descripción breve</label>
                  <input id="p-desc" type="text" value="${escapeHTML(initialDesc)}" placeholder="Ej. Presentación, marca o proveedor" />
                </div>
              </div>
            `
                : ''
            }

            <!-- Identificación visual (color o foto local) -->
            <div class="pf-media-box">
              <div class="pf-media-preview-wrap">
                <img id="pf-image-preview" src="${escapeHTML(previewSrc)}" alt="Vista previa del producto" class="pf-image-preview" />
              </div>
              <div class="pf-media-controls">
                <div class="form-field">
                  <label>Color de tarjeta en POS (si no usas foto)</label>
                  <div class="pf-color-swatches" role="radiogroup" aria-label="Color identificativo">
                    ${PRODUCT_COLOR_PALETTE.map(
                      (c) => `
                      <button
                        type="button"
                        class="pf-color-swatch ${initialColor === c.id ? 'active' : ''}"
                        data-color-choice="${c.id}"
                        style="--swatch-bg: ${c.bg}; --swatch-accent: ${c.accent};"
                        title="${c.label}"
                        aria-label="Color ${c.label}"
                        aria-pressed="${initialColor === c.id ? 'true' : 'false'}"
                      ></button>
                    `
                    ).join('')}
                  </div>
                </div>
                <div class="pf-upload-row">
                  <label class="btn btn-outline btn-xs pf-upload-btn" for="p-image-file">
                    ${icon('upload', 13)}
                    <span>Subir foto</span>
                  </label>
                  <input id="p-image-file" type="file" accept="image/*" hidden />
                  <button type="button" class="btn btn-ghost btn-xs" id="btn-clear-image" ${initialImage ? '' : 'hidden'}>
                    Quitar foto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </details>

        <div id="p-error" class="alert-error" role="alert" hidden></div>

        <div class="dialog-actions pf-dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          ${
            !isEdit
              ? `<button type="button" class="btn btn-outline" id="btn-save-and-new">Guardar y crear otro</button>`
              : ''
          }
          <button type="submit" class="btn btn-primary" id="btn-save-product">
            ${isEdit ? 'Guardar Cambios' : 'Crear Producto'}
          </button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-product')
      const errBox = modal.querySelector('#p-error')
      const detailsEl = modal.querySelector('#pf-secondary-details')
      const nameInput = modal.querySelector('#p-name')
      const priceInput = modal.querySelector('#p-price')
      const costInput = modal.querySelector('#p-cost')
      const unitSelect = modal.querySelector('#p-unit')
      const catSelect = modal.querySelector('#p-cat')
      const skuInput = modal.querySelector('#p-sku')
      const barcodeInput = modal.querySelector('#p-barcode')
      const minInput = modal.querySelector('#p-min')
      const descInput = modal.querySelector('#p-desc')
      const marginPill = modal.querySelector('#pf-margin-pill')
      const unitHint = modal.querySelector('#pf-unit-hint')
      const previewImg = modal.querySelector('#pf-image-preview')
      const fileInput = modal.querySelector('#p-image-file')
      const clearImgBtn = modal.querySelector('#btn-clear-image')
      const saveBtn = modal.querySelector('#btn-save-product')
      const saveAndNewBtn = modal.querySelector('#btn-save-and-new')

      let selectedColor = initialColor
      let uploadedImageDataUrl = initialImage || null
      let isSaving = false

      function refreshPreview() {
        if (!previewImg) return
        if (uploadedImageDataUrl) {
          previewImg.src = uploadedImageDataUrl
        } else {
          previewImg.src = buildAestheticFallbackSVG(
            nameInput?.value.trim() || 'Producto',
            skuInput?.value.trim() || 'AUTO',
            selectedColor
          )
        }
      }

      function refreshMargin() {
        if (!marginPill) return
        const m = computeMarginStats(priceInput?.value, costInput?.value)
        marginPill.className = `pf-margin-pill margin-${m.status}`
        marginPill.textContent = m.text
      }

      function clearFieldErrors() {
        errBox.hidden = true
        errBox.textContent = ''
        modal.querySelectorAll('.field-error').forEach((el) => {
          el.hidden = true
          el.textContent = ''
        })
        modal.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
          el.removeAttribute('aria-invalid')
        })
      }

      function setFieldError(inputId, msg, inSecondary = false) {
        const input = modal.querySelector(`#${inputId}`)
        const errSpan = modal.querySelector(`#err-${inputId}`)
        if (inSecondary && detailsEl) {
          detailsEl.open = true
        }
        if (input) input.setAttribute('aria-invalid', 'true')
        if (errSpan) {
          errSpan.textContent = msg
          errSpan.hidden = false
        }
        return input
      }

      nameInput?.addEventListener('input', refreshPreview)
      skuInput?.addEventListener('input', refreshPreview)
      priceInput?.addEventListener('input', refreshMargin)
      costInput?.addEventListener('input', refreshMargin)

      unitSelect?.addEventListener('change', () => {
        const bulk = isBulkUnit(unitSelect.value)
        if (unitHint) {
          unitHint.textContent = bulk
            ? 'Permite cantidades decimales en el POS (ej. 0.5).'
            : 'Se vende en unidades enteras en el POS.'
        }
        const qtyInput = modal.querySelector('#p-lot-qty')
        if (qtyInput) qtyInput.step = bulk ? '0.001' : '1'
      })

      // Botón sugerir SKU automático
      modal.querySelector('#btn-auto-sku')?.addEventListener('click', () => {
        const suggested = generateUniqueSKU(nameInput?.value || 'PRD', getState().products || [])
        if (skuInput) {
          skuInput.value = suggested
          refreshPreview()
        }
      })

      // Crear categoría inline sin cerrar ni perder datos del producto
      const inlineCatBox = modal.querySelector('#inline-cat-box')
      const inlineCatInput = modal.querySelector('#inline-cat-name')
      modal.querySelector('#btn-inline-new-cat')?.addEventListener('click', () => {
        if (!inlineCatBox) return
        inlineCatBox.hidden = !inlineCatBox.hidden
        if (!inlineCatBox.hidden) inlineCatInput?.focus()
      })
      modal.querySelector('#btn-inline-cat-cancel')?.addEventListener('click', () => {
        if (inlineCatBox) inlineCatBox.hidden = true
        if (inlineCatInput) inlineCatInput.value = ''
      })
      modal.querySelector('#btn-inline-cat-save')?.addEventListener('click', async () => {
        const newCatName = inlineCatInput?.value.trim() || ''
        if (newCatName.length < 2) {
          errBox.textContent = 'Escribe al menos 2 caracteres para la nueva categoría.'
          errBox.hidden = false
          inlineCatInput?.focus()
          return
        }
        errBox.hidden = true
        try {
          const createdCat = await createCategoryRequest({ name: newCatName })
          const opt = document.createElement('option')
          opt.value = createdCat.id
          opt.textContent = createdCat.name
          opt.selected = true
          catSelect?.appendChild(opt)
          // Sincronizar categorías en estado sin re-renderizar ni cerrar modal
          setState({ categories: [...(getState().categories || []), createdCat] }, false)
          if (inlineCatInput) inlineCatInput.value = ''
          if (inlineCatBox) inlineCatBox.hidden = true
          showToast('ok', `Categoría "${createdCat.name}" creada y seleccionada.`)
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })

      // En edición: acceso directo a ingresar un lote sin perder contexto
      modal.querySelector('#btn-edit-add-lot')?.addEventListener('click', () => {
        if (product?.id) {
          openCreateLotModal(product.id, refreshAll)
        }
      })

      // Selector de color
      modal.querySelectorAll('[data-color-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedColor = btn.getAttribute('data-color-choice') || 'slate'
          modal.querySelectorAll('[data-color-choice]').forEach((b) => {
            const active = b === btn
            b.classList.toggle('active', active)
            b.setAttribute('aria-pressed', active ? 'true' : 'false')
          })
          refreshPreview()
        })
      })

      // Subir foto local (comprimida en canvas)
      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
          uploadedImageDataUrl = await compressImageFileToDataURL(file, 240)
          if (clearImgBtn) clearImgBtn.hidden = false
          refreshPreview()
        } catch (err) {
          errBox.textContent = err.message
          errBox.hidden = false
        }
      })

      clearImgBtn?.addEventListener('click', () => {
        uploadedImageDataUrl = null
        if (fileInput) fileInput.value = ''
        clearImgBtn.hidden = true
        refreshPreview()
      })

      async function handleSave(createAnother = false) {
        if (isSaving) return
        clearFieldErrors()

        let firstInvalid = null
        const markErr = (id, msg, inSec = false) => {
          const el = setFieldError(id, msg, inSec)
          if (!firstInvalid) firstInvalid = el
        }

        const nameVal = nameInput?.value.trim() || ''
        if (nameVal.length < 2) {
          markErr('p-name', 'Ingresa un nombre de al menos 2 caracteres.')
        }

        const priceRaw = priceInput?.value.trim() || ''
        const priceNum = Number(priceRaw)
        if (!priceRaw || !Number.isFinite(priceNum) || priceNum <= 0) {
          markErr('p-price', 'Ingresa un precio de venta mayor a $0.')
        }

        const costRaw = costInput?.value.trim() || ''
        const costNum = costRaw === '' ? 0 : Number(costRaw)
        if (costRaw !== '' && (!Number.isFinite(costNum) || costNum < 0)) {
          markErr('p-cost', 'El costo unitario debe ser 0 o mayor.')
        }

        const minRaw = minInput?.value.trim() || ''
        const minNum = minRaw === '' ? 5 : Number(minRaw)
        if (!Number.isFinite(minNum) || minNum < 0) {
          markErr('p-min', 'El stock mínimo debe ser 0 o mayor.', true)
        }

        const skuVal = skuInput?.value.trim() || ''
        if (isEdit && !skuVal) {
          markErr('p-sku', 'El SKU no puede quedar vacío al editar.', true)
        }

        let initQty = 0
        if (!isEdit) {
          const qtyRaw = modal.querySelector('#p-lot-qty')?.value.trim() || ''
          initQty = qtyRaw === '' ? 0 : Number(qtyRaw)
          if (!Number.isFinite(initQty) || initQty < 0) {
            markErr('p-lot-qty', 'La cantidad inicial debe ser 0 o mayor.')
          }
        }

        if (firstInvalid) {
          errBox.textContent = 'Revisa los campos marcados en rojo antes de guardar.'
          errBox.hidden = false
          firstInvalid.focus()
          return
        }

        const payload = {
          name: nameVal,
          category_id: catSelect?.value || null,
          sku: skuVal,
          barcode: barcodeInput?.value.trim() || null,
          unit: unitSelect?.value || 'und',
          sale_price: priceNum,
          unit_cost: costNum,
          min_stock: minNum,
          description: descInput?.value.trim() || '',
          color_tag: selectedColor,
          image_url: uploadedImageDataUrl,
        }

        if (!isEdit && initQty > 0) {
          payload.initial_lot = {
            lot_number: modal.querySelector('#p-lot-num')?.value.trim() || '',
            quantity: initQty,
            unit_cost: costNum,
            entry_date: modal.querySelector('#p-lot-entry')?.value || today,
            expiration_date: modal.querySelector('#p-lot-exp')?.value || null,
          }
        }

        isSaving = true
        if (saveBtn) {
          saveBtn.disabled = true
          saveBtn.textContent = 'Guardando...'
        }
        if (saveAndNewBtn) saveAndNewBtn.disabled = true

        try {
          if (isEdit) {
            await updateProductRequest(product.id, payload)
            closeDialog()
            await refreshAll()
            showToast('ok', `Producto "${payload.name}" actualizado correctamente.`)
          } else {
            const created = await createProductRequest(payload)
            await refreshAll()
            if (createAnother) {
              closeDialog()
              showToast('ok', `Producto "${created.name}" (${created.sku}) creado. Listo para el siguiente.`)
              openProductFormModal(null, refreshAll)
            } else {
              closeDialog()
              showToast(
                'ok',
                `Producto "${created.name}" (${created.sku}) creado${initQty > 0 ? ` con ${initQty} ${created.unit}` : ' (sin stock inicial)'}.`
              )
            }
          }
        } catch (err) {
          // Conservar todos los datos escritos y enfocar el campo relacionado si aplica
          const msg = err.message || 'No se pudo guardar el producto.'
          errBox.textContent = msg
          errBox.hidden = false
          if (/SKU/i.test(msg)) {
            const el = setFieldError('p-sku', msg, true)
            el?.focus()
          } else if (/barras|EAN/i.test(msg)) {
            const el = setFieldError('p-barcode', msg, true)
            el?.focus()
          } else if (/precio/i.test(msg)) {
            const el = setFieldError('p-price', msg, false)
            el?.focus()
          }
          isSaving = false
          if (saveBtn) {
            saveBtn.disabled = false
            saveBtn.textContent = isEdit ? 'Guardar Cambios' : 'Crear Producto'
          }
          if (saveAndNewBtn) saveAndNewBtn.disabled = false
        }
      }

      form?.addEventListener('submit', (e) => {
        e.preventDefault()
        handleSave(false)
      })

      saveAndNewBtn?.addEventListener('click', () => {
        handleSave(true)
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
  if (!isOwner(st.user)) {
    showToast('error', 'Permiso denegado: solo el Dueño puede registrar lotes.')
    return
  }
  const products = st.products || []
  if (products.length === 0) {
    showToast('error', 'Primero debes crear al menos un producto.')
    return
  }

  const preselectedProd =
    products.find((p) => p.id === preselectedProductId) || products[0]
  const today = getTodayISO()
  const sugLot = `L-${today.replace(/-/g, '')}-${String((st.lots?.length || 0) + 1).padStart(2, '0')}`

  openDialog({
    title: 'Registrar Nuevo Lote de Inventario',
    subtitle: 'Ingresa las unidades recibidas, su fecha de entrada y fecha de vencimiento.',
    maxWidth: '520px',
    bodyHTML: `
      <form id="form-new-lot" class="form-stack" novalidate>
        <div class="form-field">
          <label for="nl-product">Producto *</label>
          <select id="nl-product" required>
            ${products
              .map(
                (p) =>
                  `<option value="${p.id}" ${preselectedProd?.id === p.id ? 'selected' : ''}>${escapeHTML(p.name)} (${escapeHTML(p.sku)})</option>`
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
            <input id="nl-qty" type="number" inputmode="decimal" step="0.001" min="0.001" required placeholder="Ej. 24" autofocus />
          </div>
          <div class="form-field">
            <label for="nl-cost">Costo Unitario (COP)</label>
            <input id="nl-cost" type="number" inputmode="decimal" step="any" min="0" value="${preselectedProd?.unit_cost ?? 0}" />
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

        <div id="nl-error" class="alert-error" role="alert" hidden></div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-save-lot">Guardar Lote</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-new-lot')
      const errBox = modal.querySelector('#nl-error')
      const saveBtn = modal.querySelector('#btn-save-lot')
      const prodSel = modal.querySelector('#nl-product')
      const costInp = modal.querySelector('#nl-cost')
      let saving = false

      prodSel?.addEventListener('change', () => {
        const chosen = products.find((p) => p.id === prodSel.value)
        if (chosen && costInp) {
          costInp.value = chosen.unit_cost ?? 0
        }
      })

      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (saving) return
        errBox.hidden = true
        saving = true
        if (saveBtn) {
          saveBtn.disabled = true
          saveBtn.textContent = 'Guardando...'
        }
        try {
          await createLotRequest({
            product_id: modal.querySelector('#nl-product').value,
            lot_number: modal.querySelector('#nl-code').value.trim(),
            quantity: Number(modal.querySelector('#nl-qty').value),
            unit_cost: Number(modal.querySelector('#nl-cost').value || 0),
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
          saving = false
          if (saveBtn) {
            saveBtn.disabled = false
            saveBtn.textContent = 'Guardar Lote'
          }
        }
      })
    },
  })
}

function openAdjustLotModal(lot, refreshAll) {
  if (!isOwner(getState().user)) {
    showToast('error', 'Permiso denegado: solo el Dueño puede ajustar lotes.')
    return
  }
  openDialog({
    title: `Movimiento de Lote · ${escapeHTML(lot.lot_number)}`,
    subtitle: `${escapeHTML(lot.product_name)} · Saldo actual: ${formatQty(lot.available_quantity, lot.product_unit)}`,
    maxWidth: '500px',
    bodyHTML: `
      <form id="form-adjust-lot" class="form-stack" novalidate>
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
            <input id="adj-qty" type="number" inputmode="decimal" step="0.001" min="0" required value="1" autofocus />
          </div>
          <div class="form-field">
            <label for="adj-cost">Costo Unitario (COP)</label>
            <input id="adj-cost" type="number" inputmode="decimal" step="any" min="0" required value="${lot.unit_cost}" />
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

        <div id="adj-error" class="alert-error" role="alert" hidden></div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog-close>Cancelar</button>
          <button type="submit" class="btn btn-primary" id="btn-save-adjust">Registrar Movimiento</button>
        </div>
      </form>
    `,
    onMount(modal) {
      const form = modal.querySelector('#form-adjust-lot')
      const errBox = modal.querySelector('#adj-error')
      const saveBtn = modal.querySelector('#btn-save-adjust')
      let saving = false
      form?.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (saving) return
        errBox.hidden = true
        saving = true
        if (saveBtn) {
          saveBtn.disabled = true
          saveBtn.textContent = 'Registrando...'
        }
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
          saving = false
          if (saveBtn) {
            saveBtn.disabled = false
            saveBtn.textContent = 'Registrar Movimiento'
          }
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
          <span class="metric-label">Bancolombia</span>
          <strong class="metric-val">${formatCOP(byMethod.bancolombia || 0)}</strong>
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
            <option value="bancolombia" ${st.salesFilterMethod === 'bancolombia' ? 'selected' : ''}>Bancolombia</option>
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
