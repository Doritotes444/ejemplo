import { isOwner } from '../core/permissions.js'
import {
  getState,
  setState,
  addItemToCartList,
  decrementItemInCartList,
  setItemQuantityInCartList,
  removeItemFromCartList,
  calculateCartTotal,
  showFeedback,
} from '../state.js'
import { registerSale } from '../services/sales.js'
import { formatCOP, BILLETES_RAPIDOS, calculateChange } from '../utils/money.js'
import { isBulkUnit, formatQty } from '../utils/quantities.js'
import { resolverFotoProducto } from '../utils/images.js'
import { openProductLotsModal, openProductModal } from './lots.js'

const METODOS_PAGO = ['Efectivo', 'Nequi', 'DaviPlata', 'Transferencia', 'Tarjeta', 'Fiado']

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getFilteredProducts(state) {
  const q = String(state.searchQuery || '').trim().toLowerCase()
  const cat = state.categoryFilter || 'Todas'
  let list = state.products || []

  if (state.onlyFrequent) {
    list = list.filter((p) => p.es_frecuente)
  }
  if (cat && cat !== 'Todas') {
    list = list.filter((p) => p.categoria === cat)
  }
  if (q) {
    list = list.filter(
      (p) =>
        String(p.nombre || '').toLowerCase().includes(q) ||
        String(p.codigo_barras || '').toLowerCase().includes(q) ||
        String(p.categoria || '').toLowerCase().includes(q)
    )
  }
  return list
}

export function renderPOSSectionHTML(state) {
  const ownerMode = isOwner(state.user)
  const filteredProducts = getFilteredProducts(state)
  const categories = ['Todas', ...new Set((state.products || []).map((p) => p.categoria).filter(Boolean))]
  const cartTotal = calculateCartTotal(state.cart)
  const receivedNum =
    state.paymentMethod === 'Efectivo' && state.amountReceived !== ''
      ? Number(state.amountReceived)
      : cartTotal
  const change =
    state.paymentMethod === 'Efectivo' && state.amountReceived !== ''
      ? calculateChange(receivedNum, cartTotal)
      : 0

  const catalogCardsHTML =
    filteredProducts.length === 0
      ? `
        <div class="empty-catalog-state">
          <p>No se encontraron productos para esta búsqueda.</p>
          ${
            ownerMode
              ? `<button type="button" class="btn btn-primary" id="btn-pos-create-empty">+ Crear Producto con este código</button>`
              : `<small class="text-muted">Modo Tendero bloqueado: solicita al Dueño registrar nuevos productos.</small>`
          }
        </div>
      `
      : filteredProducts
          .map((prod) => {
            const available = Number(prod.cantidad_disponible || 0)
            const outOfStock = available <= 0
            const lowStock = !outOfStock && available <= Number(prod.stock_minimo || 5)
            const inCartItem = state.cart.find((c) => c.id === prod.id)
            const nextLot = prod.proximo_lote

            let stockBadgeClass = 'pill-ok'
            if (outOfStock) stockBadgeClass = 'pill-zero'
            else if (lowStock) stockBadgeClass = 'pill-low'

            return `
              <article class="product-card ${outOfStock ? 'is-out' : ''} ${inCartItem ? 'in-cart' : ''}" data-add-product="${prod.id}">
                <div class="product-card-top">
                  <img src="${resolverFotoProducto(prod)}" alt="${escapeHTML(prod.nombre)}" class="product-thumb" loading="lazy" />
                  <div class="product-badges">
                    <span class="stock-pill ${stockBadgeClass}">
                      ${outOfStock ? 'Agotado' : formatQty(available, prod.unidad_medida)}
                    </span>
                    ${
                      inCartItem
                        ? `<span class="cart-count-pill">En carrito: ${inCartItem.cantidad}</span>`
                        : ''
                    }
                  </div>
                </div>

                <div class="product-card-body">
                  <h3 class="product-name" title="${escapeHTML(prod.nombre)}">${escapeHTML(prod.nombre)}</h3>
                  <div class="product-meta">
                    <span class="product-code">${escapeHTML(prod.codigo_barras)}</span>
                    ${
                      nextLot
                        ? `<span class="lot-mini-tag" title="Próximo lote en descontarse por FIFO">FIFO: ${escapeHTML(nextLot.codigo_lote)}</span>`
                        : prod.cantidad_vencida > 0
                        ? `<span class="lot-mini-tag tag-expired">Lote vencido bloqueado</span>`
                        : ''
                    }
                  </div>
                  <div class="product-price-row">
                    <strong class="product-price">${formatCOP(prod.precio_venta)}</strong>
                    ${isBulkUnit(prod.unidad_medida) ? `<small>/ ${escapeHTML(prod.unidad_medida)}</small>` : ''}
                  </div>
                </div>

                ${
                  ownerMode
                    ? `
                  <div class="product-owner-bar" data-stop-card-click>
                    <button type="button" class="btn-card-owner" data-open-lots="${prod.id}">
                      Lotes FIFO (${(prod.lotes || []).length})
                    </button>
                    <button type="button" class="btn-card-owner" data-open-edit="${prod.id}">
                      Editar
                    </button>
                  </div>
                `
                    : ''
                }
              </article>
            `
          })
          .join('')

  const cartItemsHTML =
    state.cart.length === 0
      ? `
        <div class="cart-empty">
          <p>El carrito está vacío</p>
          <small>Toca cualquier producto o escanea su código de barras para vender y descontar stock por FIFO.</small>
        </div>
      `
      : state.cart
          .map((item) => {
            const bulk = isBulkUnit(item.unidad_medida)
            const lineSubtotal = Number(item.precio_venta) * Number(item.cantidad)
            return `
              <div class="cart-item">
                <div class="cart-item-info">
                  <strong>${escapeHTML(item.nombre)}</strong>
                  <small>${formatCOP(item.precio_venta)} ${bulk ? `/ ${escapeHTML(item.unidad_medida)}` : 'c/u'} · Disp: ${item.cantidad_disponible}</small>
                </div>
                <div class="cart-item-controls">
                  ${
                    bulk
                      ? `<input type="number" class="qty-input-bulk" step="0.05" min="0.001" max="${item.cantidad_disponible}" value="${item.cantidad}" data-set-qty="${item.id}" aria-label="Cantidad en ${escapeHTML(item.unidad_medida)}" />`
                      : `
                        <div class="qty-stepper">
                          <button type="button" class="btn-step" data-dec-qty="${item.id}" aria-label="Restar 1">−</button>
                          <span class="qty-value">${item.cantidad}</span>
                          <button type="button" class="btn-step" data-inc-qty="${item.id}" aria-label="Sumar 1">+</button>
                        </div>
                      `
                  }
                  <strong class="cart-item-subtotal">${formatCOP(lineSubtotal)}</strong>
                  <button type="button" class="btn-remove-item" data-remove-item="${item.id}" title="Quitar del carrito">✕</button>
                </div>
              </div>
            `
          })
          .join('')

  return `
    <div class="pos-workspace">
      <!-- Columna Catálogo y Búsqueda -->
      <section class="pos-catalog-col" aria-label="Catálogo de productos">
        <div class="search-toolbar">
          <div class="search-input-wrap">
            <input
              id="pos-search-input"
              type="search"
              value="${escapeHTML(state.searchQuery)}"
              placeholder="Buscar producto o escanear código de barras (Enter para agregar)..."
              autocomplete="off"
            />
          </div>
          <div class="filter-pills">
            <button type="button" class="pill-btn ${!state.onlyFrequent ? 'active' : ''}" id="btn-filter-all">
              Todos (${state.products.length})
            </button>
            <button type="button" class="pill-btn ${state.onlyFrequent ? 'active' : ''}" id="btn-filter-freq">
              ★ Frecuentes
            </button>
            ${categories
              .filter((c) => c !== 'Todas')
              .map(
                (cat) => `
                <button type="button" class="pill-btn ${state.categoryFilter === cat ? 'active' : ''}" data-cat-filter="${escapeHTML(cat)}">
                  ${escapeHTML(cat)}
                </button>
              `
              )
              .join('')}
            ${
              ownerMode
                ? `<button type="button" class="btn btn-sm btn-primary ml-auto" id="btn-pos-quick-new">+ Producto / Lote</button>`
                : `<span class="locked-role-indicator ml-auto" title="El Tendero solo puede vender y descontar existencias">🔒 Modo Tendero (Solo Venta)</span>`
            }
          </div>
        </div>

        <div class="products-grid">
          ${catalogCardsHTML}
        </div>
      </section>

      <!-- Columna Carrito y Cobro Rápido -->
      <aside class="pos-cart-col" aria-label="Carrito de venta y cobro">
        <div class="cart-header">
          <div>
            <h2>Ticket de Venta</h2>
            <small>Descuento automático por lote (FIFO)</small>
          </div>
          ${
            state.cart.length > 0
              ? `<button type="button" class="btn btn-xs btn-ghost-danger" id="btn-clear-cart">Vaciar (Esc)</button>`
              : `<span class="badge badge-neutral">0 ítems</span>`
          }
        </div>

        <div class="cart-items-list">
          ${cartItemsHTML}
        </div>

        <div class="cart-checkout-box">
          <div class="payment-methods-grid">
            ${METODOS_PAGO.map(
              (m) => `
                <button
                  type="button"
                  class="pay-method-btn ${state.paymentMethod === m ? 'active' : ''}"
                  data-pay-method="${m}"
                >
                  ${m}
                </button>
              `
            ).join('')}
          </div>

          ${
            state.paymentMethod === 'Efectivo' && state.cart.length > 0
              ? `
                <div class="cash-helper-box">
                  <div class="quick-bills-row">
                    <button type="button" class="bill-chip" data-quick-bill="${Math.round(cartTotal)}">Exacto</button>
                    ${BILLETES_RAPIDOS.map(
                      (b) => `<button type="button" class="bill-chip" data-quick-bill="${b}">$${b / 1000}k</button>`
                    ).join('')}
                  </div>
                  <div class="cash-inputs-row">
                    <div class="field-compact">
                      <label for="pos-amount-received">Efectivo recibido</label>
                      <input
                        id="pos-amount-received"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="${Math.round(cartTotal)}"
                        value="${escapeHTML(state.amountReceived)}"
                      />
                    </div>
                    <div class="change-display">
                      <span>Cambio / Vueltas</span>
                      <strong>${formatCOP(change)}</strong>
                    </div>
                  </div>
                </div>
              `
              : ''
          }

          ${
            state.paymentMethod === 'Fiado' && state.cart.length > 0
              ? `
                <div class="field-compact">
                  <label for="pos-customer-name">Nombre del cliente (Fiado)</label>
                  <input
                    id="pos-customer-name"
                    type="text"
                    placeholder="Ej. Doña Martha Rojas"
                    value="${escapeHTML(state.customerName)}"
                  />
                </div>
              `
              : ''
          }

          <div class="cart-total-row">
            <span>Total a Cobrar</span>
            <strong class="total-amount">${formatCOP(cartTotal)}</strong>
          </div>

          <button
            type="button"
            id="btn-confirm-sale"
            class="btn btn-checkout"
            ${state.cart.length === 0 ? 'disabled' : ''}
          >
            Cobrar y Descontar Stock (${formatCOP(cartTotal)}) [F2]
          </button>
        </div>
      </aside>
    </div>
  `
}

export function bindPOSEvents(root, refreshAllData) {
  const searchInput = root.querySelector('#pos-search-input')

  searchInput?.addEventListener('input', (e) => {
    setState({ searchQuery: e.target.value })
    // Restaurar foco y posición del cursor tras el re-render
    const nextInput = document.querySelector('#pos-search-input')
    if (nextInput) {
      nextInput.focus()
      const len = nextInput.value.length
      nextInput.setSelectionRange(len, len)
    }
  })

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const st = getState()
      const q = String(st.searchQuery || '').trim().toLowerCase()
      if (!q) return

      const exactBarcode = st.products.find(
        (p) => String(p.codigo_barras || '').trim().toLowerCase() === q
      )
      const filtered = getFilteredProducts(st)
      const target = exactBarcode || (filtered.length === 1 ? filtered[0] : null)

      if (target) {
        const res = addItemToCartList(st.cart, target, 1)
        if (!res.added && res.reason) {
          showFeedback('error', res.reason)
        } else {
          setState({ cart: res.cart, searchQuery: '' })
          showFeedback('ok', `Agregado: ${target.nombre}`)
        }
        document.querySelector('#pos-search-input')?.focus()
      } else {
        showFeedback('error', `No se encontró producto con "${st.searchQuery}".`)
      }
    }
  })

  root.querySelector('#btn-filter-all')?.addEventListener('click', () => {
    setState({ onlyFrequent: false, categoryFilter: 'Todas' })
  })

  root.querySelector('#btn-filter-freq')?.addEventListener('click', () => {
    setState({ onlyFrequent: true })
  })

  root.querySelectorAll('[data-cat-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat-filter')
      const current = getState().categoryFilter
      setState({ categoryFilter: current === cat ? 'Todas' : cat, onlyFrequent: false })
    })
  })

  root.querySelector('#btn-pos-quick-new')?.addEventListener('click', () => {
    openProductModal(null, refreshAllData)
  })

  root.querySelector('#btn-pos-create-empty')?.addEventListener('click', () => {
    openProductModal(null, refreshAllData, getState().searchQuery)
  })

  // Click en tarjeta de producto (agrega +1 al carrito)
  root.querySelectorAll('[data-add-product]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-stop-card-click]')) return
      const prodId = card.getAttribute('data-add-product')
      const st = getState()
      const prod = st.products.find((p) => p.id === prodId)
      if (!prod) return
      const res = addItemToCartList(st.cart, prod, 1)
      if (!res.added && res.reason) {
        showFeedback('error', res.reason)
        return
      }
      setState({ cart: res.cart })
    })
  })

  // Botones rápidos de Dueño dentro de la tarjeta
  root.querySelectorAll('[data-open-lots]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      openProductLotsModal(btn.getAttribute('data-open-lots'), refreshAllData)
    })
  })

  root.querySelectorAll('[data-open-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const prod = getState().products.find((p) => p.id === btn.getAttribute('data-open-edit'))
      if (prod) openProductModal(prod, refreshAllData)
    })
  })

  // Controles del carrito
  root.querySelectorAll('[data-inc-qty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-inc-qty')
      const st = getState()
      const prod = st.products.find((p) => p.id === id)
      if (!prod) return
      const res = addItemToCartList(st.cart, prod, 1)
      if (!res.added && res.reason) {
        showFeedback('error', res.reason)
      }
      setState({ cart: res.cart })
    })
  })

  root.querySelectorAll('[data-dec-qty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-dec-qty')
      const st = getState()
      setState({ cart: decrementItemInCartList(st.cart, id, 1) })
    })
  })

  root.querySelectorAll('[data-set-qty]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const id = input.getAttribute('data-set-qty')
      const st = getState()
      const prod = st.products.find((p) => p.id === id)
      setState({
        cart: setItemQuantityInCartList(st.cart, id, e.target.value, prod?.cantidad_disponible),
      })
    })
  })

  root.querySelectorAll('[data-remove-item]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-remove-item')
      setState({ cart: removeItemFromCartList(getState().cart, id) })
    })
  })

  root.querySelector('#btn-clear-cart')?.addEventListener('click', () => {
    setState({ cart: [], amountReceived: '', customerName: '' })
  })

  root.querySelectorAll('[data-pay-method]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ paymentMethod: btn.getAttribute('data-pay-method') })
    })
  })

  root.querySelectorAll('[data-quick-bill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ amountReceived: btn.getAttribute('data-quick-bill') })
    })
  })

  root.querySelector('#pos-amount-received')?.addEventListener('input', (e) => {
    setState({ amountReceived: e.target.value })
    const el = document.querySelector('#pos-amount-received')
    if (el) el.focus()
  })

  root.querySelector('#pos-customer-name')?.addEventListener('input', (e) => {
    setState({ customerName: e.target.value })
    const el = document.querySelector('#pos-customer-name')
    if (el) el.focus()
  })

  root.querySelector('#btn-confirm-sale')?.addEventListener('click', () => {
    executeCheckout(refreshAllData)
  })
}

export async function executeCheckout(refreshAllData) {
  const st = getState()
  if (!st.cart.length) return

  try {
    const sale = await registerSale(
      st.cart,
      {
        metodo_pago: st.paymentMethod,
        monto_recibido: st.amountReceived !== '' ? Number(st.amountReceived) : undefined,
        cliente_nombre: st.customerName || null,
      },
      st.user
    )

    const lotesUsados = sale.detalles
      .flatMap((d) => (d.asignaciones_lote || []).map((a) => `${a.codigo_lote} (-${a.cantidad_descontada})`))
      .join(', ')

    setState(
      {
        cart: [],
        amountReceived: '',
        customerName: '',
      },
      false
    )

    if (typeof refreshAllData === 'function') {
      await refreshAllData()
    }

    const changeMsg = sale.cambio_entregado > 0 ? ` · Cambio: ${formatCOP(sale.cambio_entregado)}` : ''
    showFeedback(
      'ok',
      `Venta completada por ${formatCOP(sale.total)}${changeMsg} · Lotes FIFO descontados: ${lotesUsados}`
    )
  } catch (err) {
    showFeedback('error', err.message || 'No se pudo completar la venta.')
  }
}
