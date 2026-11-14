import {
  getState,
  setState,
  addProductToCart,
  updateCartItemQty,
  removeCartItem,
  calculateCartTotals,
  showToast,
} from '../state.js'
import { registerSaleRequest, generateClientOpId, fetchSales } from '../services/sales.js'
import { formatCOP, BILLETES_RAPIDOS, calculateChange } from '../utils/money.js'
import { isBulkUnit, formatQty } from '../utils/quantities.js'
import { icon } from './icons.js'
import { openSaleReceiptModal } from './receipt.js'
import { openDialog } from './dialog.js'

const PAYMENT_METHODS = [
  { code: 'efectivo', label: 'Efectivo' },
  { code: 'nequi', label: 'Nequi' },
  { code: 'daviplata', label: 'Daviplata' },
]

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getFilteredPOSProducts(st) {
  const q = String(st.posSearch || '').trim().toLowerCase()
  const cat = st.posCategory || 'ALL'

  return (st.products || []).filter((p) => {
    if (!p.is_active) return false
    if (cat !== 'ALL' && p.category_id !== cat) return false
    if (!q) return true
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    )
  })
}

export function renderPOSViewHTML(st) {
  const products = getFilteredPOSProducts(st)
  const categories = st.categories || []
  const { subtotal, total } = calculateCartTotals(st.cart)

  const receivedNum =
    st.paymentMethod === 'efectivo' && st.amountReceived !== ''
      ? Number(st.amountReceived)
      : total
  const changeAmount =
    st.paymentMethod === 'efectivo' && st.amountReceived !== ''
      ? calculateChange(receivedNum, total)
      : 0

  const rowsHTML =
    products.length === 0
      ? `
        <div class="empty-state">
          <p class="empty-title">No hay productos disponibles para este criterio</p>
          <p class="empty-subtitle">Ajusta el término de búsqueda o verifica que existan productos activos con stock vigente.</p>
        </div>
      `
      : `
        <div class="pos-catalog-grid">
          ${products
            .map((p) => {
              const avail = Number(p.available_stock || 0)
              const isOut = avail <= 0
              const isLow = !isOut && p.is_low_stock
              const inCart = st.cart.find((c) => c.product_id === p.id)

              let stockBadge = `<span class="status-badge badge-success">${formatQty(avail, p.unit)}</span>`
              if (isOut) {
                stockBadge = `<span class="status-badge badge-danger">Agotado</span>`
              } else if (isLow) {
                stockBadge = `<span class="status-badge badge-warning">${formatQty(avail, p.unit)}</span>`
              }

              return `
                <button
                  type="button"
                  class="pos-product-tile ${isOut ? 'tile-disabled' : ''} ${inCart ? 'tile-selected' : ''}"
                  data-pos-add="${p.id}"
                  ${isOut ? 'disabled' : ''}
                >
                  <div class="tile-top">
                    <span class="tile-sku">${escapeHTML(p.sku)}${p.barcode ? ` · ${escapeHTML(p.barcode)}` : ''}</span>
                    ${stockBadge}
                  </div>
                  <div class="tile-name">${escapeHTML(p.name)}</div>
                  <div class="tile-bottom">
                    <div class="tile-price">
                      <strong>${formatCOP(p.sale_price)}</strong>
                      <small>/ ${escapeHTML(p.unit)}</small>
                    </div>
                    ${
                      inCart
                        ? `<span class="tile-cart-qty">${inCart.quantity} en ticket</span>`
                        : p.next_lot_number
                        ? `<span class="tile-lot-hint">Lote ${escapeHTML(p.next_lot_number)}</span>`
                        : ''
                    }
                  </div>
                </button>
              `
            })
            .join('')}
        </div>
      `

  const cartHTML =
    st.cart.length === 0
      ? `
        <div class="cart-empty-state">
          <p>Sin artículos en la venta actual</p>
          <small>Escanea un código de barras o selecciona productos del catálogo.</small>
        </div>
      `
      : st.cart
          .map((item) => {
            const bulk = isBulkUnit(item.unit)
            const lineSubtotal = Number(item.unit_price) * Number(item.quantity)
            return `
              <div class="cart-line">
                <div class="cart-line-main">
                  <div>
                    <div class="cart-line-name">${escapeHTML(item.name)}</div>
                    <div class="cart-line-meta">
                      <span>${escapeHTML(item.sku)}</span>
                      <span>·</span>
                      <span>${formatCOP(item.unit_price)} / ${escapeHTML(item.unit)}</span>
                      <span>·</span>
                      <span>Disp: ${item.available_stock}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn-icon btn-icon-subtle"
                    data-cart-remove="${item.product_id}"
                    aria-label="Eliminar línea"
                  >
                    ${icon('trash', 14)}
                  </button>
                </div>

                <div class="cart-line-controls">
                  <div class="qty-control-group">
                    <button type="button" class="qty-btn" data-cart-dec="${item.product_id}" aria-label="Disminuir">
                      ${icon('minus', 12)}
                    </button>
                    <input
                      type="number"
                      class="qty-input"
                      step="${bulk ? '0.001' : '1'}"
                      min="${bulk ? '0.001' : '1'}"
                      max="${item.available_stock}"
                      value="${item.quantity}"
                      data-cart-input="${item.product_id}"
                      aria-label="Cantidad"
                    />
                    <button type="button" class="qty-btn" data-cart-inc="${item.product_id}" aria-label="Aumentar">
                      ${icon('plus', 12)}
                    </button>
                  </div>
                  <div class="cart-line-subtotal">${formatCOP(lineSubtotal)}</div>
                </div>
              </div>
            `
          })
          .join('')

  return `
    <div class="pos-layout">
      <!-- Panel Izquierdo: Buscador y Catálogo -->
      <section class="pos-catalog-panel" aria-label="Catálogo de productos disponibles">
        <header class="panel-toolbar">
          <div class="search-field-wrapper">
            ${icon('search', 16, 'search-icon')}
            <input
              id="pos-search-input"
              type="search"
              value="${escapeHTML(st.posSearch)}"
              placeholder="Buscar por nombre, SKU o lector de código de barras (Enter)..."
              autocomplete="off"
            />
          </div>

          <div class="toolbar-actions">
            <button type="button" class="btn btn-outline btn-sm" id="btn-pos-my-sales">
              ${icon('sales', 15)}
              <span>Mis ventas recientes</span>
            </button>
          </div>
        </header>

        <div class="category-filter-bar" role="tablist" aria-label="Filtrar por categoría">
          <button
            type="button"
            class="filter-chip ${st.posCategory === 'ALL' ? 'active' : ''}"
            data-pos-cat="ALL"
          >
            Todos
          </button>
          ${categories
            .map(
              (c) => `
              <button
                type="button"
                class="filter-chip ${st.posCategory === c.id ? 'active' : ''}"
                data-pos-cat="${c.id}"
              >
                ${escapeHTML(c.name)}
              </button>
            `
            )
            .join('')}
        </div>

        <div class="pos-catalog-scroll">
          ${rowsHTML}
        </div>
      </section>

      <!-- Panel Derecho: Ticket y Cobro -->
      <aside class="pos-ticket-panel" aria-label="Ticket de venta">
        <header class="ticket-header">
          <div>
            <h2 class="ticket-title">Orden de Venta</h2>
            <span class="ticket-subtitle">Salida automática por lote (FEFO / FIFO)</span>
          </div>
          ${
            st.cart.length > 0
              ? `<button type="button" class="btn btn-ghost btn-xs" id="btn-pos-clear-cart">Limpiar</button>`
              : ''
          }
        </header>

        <div class="ticket-lines-container">
          ${cartHTML}
        </div>

        <footer class="ticket-footer">
          <div class="payment-selector">
            <span class="section-micro-label">Método de pago</span>
            <div class="payment-Segmented">
              ${PAYMENT_METHODS.map(
                (pm) => `
                  <button
                    type="button"
                    class="segment-btn ${st.paymentMethod === pm.code ? 'active' : ''}"
                    data-pos-pay="${pm.code}"
                  >
                    ${pm.label}
                  </button>
                `
              ).join('')}
            </div>
          </div>

          ${
            st.paymentMethod === 'efectivo' && st.cart.length > 0
              ? `
                <div class="cash-calculator">
                  <div class="quick-denominations">
                    <button type="button" class="denom-btn" data-pos-denom="${Math.round(total)}">Exacto</button>
                    ${BILLETES_RAPIDOS.map(
                      (b) => `<button type="button" class="denom-btn" data-pos-denom="${b}">${formatCOP(b)}</button>`
                    ).join('')}
                  </div>
                  <div class="cash-row-grid">
                    <div class="form-field compact">
                      <label for="pos-cash-input">Efectivo recibido</label>
                      <input
                        id="pos-cash-input"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="${Math.round(total)}"
                        value="${escapeHTML(st.amountReceived)}"
                      />
                    </div>
                    <div class="change-box">
                      <span>Cambio a devolver</span>
                      <strong>${formatCOP(changeAmount)}</strong>
                    </div>
                  </div>
                </div>
              `
              : ''
          }

          <div class="ticket-summary">
            <div class="summary-row">
              <span>Subtotal</span>
              <span>${formatCOP(subtotal)}</span>
            </div>
            <div class="summary-row total">
              <span>Total a cobrar</span>
              <strong>${formatCOP(total)}</strong>
            </div>
          </div>

          <button
            type="button"
            id="btn-pos-submit"
            class="btn btn-primary btn-block btn-lg"
            ${st.cart.length === 0 ? 'disabled' : ''}
          >
            ${icon('check', 16)}
            <span>Confirmar Venta (${formatCOP(total)}) [F2]</span>
          </button>

          ${
            st.lastCompletedSale
              ? `
                <button type="button" class="btn btn-outline btn-block btn-sm" id="btn-pos-last-receipt">
                  ${icon('printer', 14)}
                  <span>Ver último comprobante (${escapeHTML(st.lastCompletedSale.folio)})</span>
                </button>
              `
              : ''
          }
        </footer>
      </aside>
    </div>
  `
}

export function bindPOSViewEvents(root, refreshCatalogAndContext) {
  const searchInput = root.querySelector('#pos-search-input')

  searchInput?.addEventListener('input', (e) => {
    setState({ posSearch: e.target.value })
    const nextInput = document.querySelector('#pos-search-input')
    if (nextInput) {
      nextInput.focus()
      const len = nextInput.value.length
      nextInput.setSelectionRange(len, len)
    }
  })

  // Soporte para lector de códigos de barras USB (emula teclado + Enter)
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const st = getState()
      const q = String(st.posSearch || '').trim().toLowerCase()
      if (!q) return

      const exactMatch = (st.products || []).find(
        (p) =>
          p.is_active &&
          (String(p.barcode || '').toLowerCase() === q ||
            String(p.sku || '').toLowerCase() === q)
      )
      const filtered = getFilteredPOSProducts(st)
      const target = exactMatch || (filtered.length === 1 ? filtered[0] : null)

      if (!target) {
        showToast('error', `No se encontró producto activo para "${st.posSearch}".`)
        return
      }

      const res = addProductToCart(st.cart, target, 1)
      if (!res.ok) {
        showToast('error', res.error)
      } else {
        setState({ cart: res.cart, posSearch: '' })
      }
      document.querySelector('#pos-search-input')?.focus()
    }
  })

  root.querySelectorAll('[data-pos-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ posCategory: btn.getAttribute('data-pos-cat') })
    })
  })

  root.querySelectorAll('[data-pos-add]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const pid = tile.getAttribute('data-pos-add')
      const st = getState()
      const prod = st.products.find((p) => p.id === pid)
      if (!prod) return
      const res = addProductToCart(st.cart, prod, 1)
      if (!res.ok) {
        showToast('error', res.error)
        return
      }
      setState({ cart: res.cart })
    })
  })

  root.querySelectorAll('[data-cart-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-cart-inc')
      const st = getState()
      const prod = st.products.find((p) => p.id === pid)
      if (!prod) return
      const res = addProductToCart(st.cart, prod, 1)
      if (!res.ok) showToast('error', res.error)
      setState({ cart: res.cart })
    })
  })

  root.querySelectorAll('[data-cart-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-cart-dec')
      const st = getState()
      const item = st.cart.find((c) => c.product_id === pid)
      if (!item) return
      const step = isBulkUnit(item.unit) ? 0.25 : 1
      const next = updateCartItemQty(st.cart, pid, item.quantity - step)
      setState({ cart: next })
    })
  })

  root.querySelectorAll('[data-cart-input]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const pid = input.getAttribute('data-cart-input')
      const st = getState()
      const prod = st.products.find((p) => p.id === pid)
      const next = updateCartItemQty(st.cart, pid, e.target.value, prod?.available_stock)
      setState({ cart: next })
    })
  })

  root.querySelectorAll('[data-cart-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-cart-remove')
      setState({ cart: removeCartItem(getState().cart, pid) })
    })
  })

  root.querySelector('#btn-pos-clear-cart')?.addEventListener('click', () => {
    setState({ cart: [], amountReceived: '' })
  })

  root.querySelectorAll('[data-pos-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ paymentMethod: btn.getAttribute('data-pos-pay') })
    })
  })

  root.querySelectorAll('[data-pos-denom]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ amountReceived: btn.getAttribute('data-pos-denom') })
    })
  })

  root.querySelector('#pos-cash-input')?.addEventListener('input', (e) => {
    setState({ amountReceived: e.target.value })
    const el = document.querySelector('#pos-cash-input')
    if (el) el.focus()
  })

  root.querySelector('#btn-pos-submit')?.addEventListener('click', () => {
    submitCurrentSale(refreshCatalogAndContext)
  })

  root.querySelector('#btn-pos-last-receipt')?.addEventListener('click', () => {
    const sale = getState().lastCompletedSale
    if (sale) openSaleReceiptModal(sale)
  })

  root.querySelector('#btn-pos-my-sales')?.addEventListener('click', async () => {
    try {
      const data = await fetchSales({})
      openMyRecentSalesModal(data.sales || [])
    } catch (err) {
      showToast('error', err.message || 'No se pudieron consultar las ventas recientes.')
    }
  })
}

let isSubmittingSale = false
let currentOperationId = null

export async function submitCurrentSale(refreshCatalogAndContext) {
  const st = getState()
  if (!st.cart.length || isSubmittingSale) return

  const { total } = calculateCartTotals(st.cart)
  if (st.paymentMethod === 'efectivo' && st.amountReceived !== '') {
    const rec = Number(st.amountReceived)
    if (!Number.isFinite(rec) || rec < total) {
      showToast('error', `El monto recibido (${formatCOP(rec)}) es menor al total (${formatCOP(total)}).`)
      return
    }
  }

  isSubmittingSale = true
  if (!currentOperationId) {
    currentOperationId = generateClientOpId()
  }

  const btn = document.querySelector('#btn-pos-submit')
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Procesando transacción...'
  }

  try {
    const payload = {
      client_operation_id: currentOperationId,
      payment_method: st.paymentMethod,
      amount_received:
        st.paymentMethod === 'efectivo' && st.amountReceived !== ''
          ? Number(st.amountReceived)
          : total,
      items: st.cart.map((c) => ({
        product_id: c.product_id,
        quantity: c.quantity,
      })),
    }

    const sale = await registerSaleRequest(payload)
    currentOperationId = null

    setState(
      {
        cart: [],
        amountReceived: '',
        lastCompletedSale: sale,
      },
      false
    )

    if (typeof refreshCatalogAndContext === 'function') {
      await refreshCatalogAndContext()
    }

    showToast('ok', `Venta ${sale.folio} registrada por ${formatCOP(sale.total)}.`)
    openSaleReceiptModal(sale)
  } catch (err) {
    showToast('error', err.message || 'Error al registrar la venta.')
    setState({})
  } finally {
    isSubmittingSale = false
  }
}

function openMyRecentSalesModal(salesList) {
  const rows =
    salesList.length === 0
      ? `<tr><td colspan="5" class="empty-cell">No has registrado ventas todavía en tu turno.</td></tr>`
      : salesList
          .slice(0, 25)
          .map((s) => {
            const dt = new Date(s.created_at).toLocaleString('es-CO', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
            return `
              <tr>
                <td><strong>${escapeHTML(s.folio)}</strong></td>
                <td>${escapeHTML(dt)}</td>
                <td><span class="status-badge badge-neutral">${escapeHTML(s.payment_method_name)}</span></td>
                <td class="num"><strong>${formatCOP(s.total)}</strong></td>
                <td class="actions-cell">
                  <button type="button" class="btn btn-outline btn-xs" data-view-receipt="${s.id}">Comprobante</button>
                </td>
              </tr>
            `
          })
          .join('')

  openDialog({
    title: 'Mis Ventas Operativas',
    subtitle: 'Consulta e impresión de comprobantes registrados en tu sesión.',
    maxWidth: '640px',
    bodyHTML: `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha y Hora</th>
              <th>Método</th>
              <th class="num">Total</th>
              <th>Comprobante</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-primary" data-dialog-close>Cerrar</button>
      </div>
    `,
    onMount(modal) {
      modal.querySelectorAll('[data-view-receipt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-view-receipt')
          const found = salesList.find((x) => x.id === sid)
          if (found) openSaleReceiptModal(found)
        })
      })
    },
  })
}
