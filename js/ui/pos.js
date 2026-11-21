import {
  getState,
  setState,
  addProductToCart,
  updateCartItemQty,
  removeCartItem,
  calculateCartTotals,
  showToast,
} from '../state.js'
import { isOwner } from '../core/permissions.js'
import { registerSaleRequest, generateClientOpId, fetchSales } from '../services/sales.js'
import {
  getUISettingsSync,
  saveUISettingsSync,
  buildAestheticFallbackSVG,
} from '../core/localStore.js'
import { formatCOP, BILLETES_RAPIDOS, calculateChange, roundMoney } from '../utils/money.js'
import { isBulkUnit, getUnitStep, formatQty } from '../utils/quantities.js'
import { icon } from './icons.js'
import { openSaleReceiptModal } from './receipt.js'
import { openDialog } from './dialog.js'
import {
  openBarcodeScannerModal,
  openTransferVerifierModal,
  handleScannedCode,
} from './hardware.js'
import { openProductFormModal } from './lots.js'
import { filterAndRankProducts } from '../utils/search.js'

const PAYMENT_METHODS = [
  { code: 'efectivo', label: 'Efectivo' },
  { code: 'nequi', label: 'Nequi' },
  { code: 'bancolombia', label: 'Bancolombia' },
  { code: 'daviplata', label: 'Daviplata' },
]

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getFilteredPOSProducts(st) {
  const cat = st.posCategory || 'ALL'
  const activeProducts = (st.products || []).filter((p) => {
    if (!p.is_active) return false
    if (cat !== 'ALL' && String(p.category_id) !== String(cat)) return false
    return true
  })
  return filterAndRankProducts(activeProducts, st.posSearch || '')
}


let inlineHtml5Scanner = null
let inlineScannerRunning = false

export async function stopInline50vhScanner() {
  if (inlineHtml5Scanner && inlineScannerRunning) {
    try {
      await inlineHtml5Scanner.stop()
      await inlineHtml5Scanner.clear()
    } catch {
      // ignore
    }
    inlineScannerRunning = false
  }
}

export function renderPOSCatalogContentHTML(allFiltered, st, ui) {
  const isStoreBlank = (st.products || []).length === 0
  const owner = isOwner(st.user)

  if (isStoreBlank) {
    return owner
      ? `
        <div class="empty-state blank-store-cta">
          <div class="blank-store-icon">${icon('products', 28)}</div>
          <h3 class="empty-title">Tu tienda está lista y en blanco (Cero datos ficticios)</h3>
          <p class="empty-subtitle">Comienza el Paso 1 del tutorial registrando tu primer producto real para habilitar las ventas en el POS.</p>
          <button type="button" class="btn btn-primary btn-lg" id="btn-empty-pos-create-first">
            ${icon('plus', 16)}
            <span>Crear Mi Primer Producto (Paso 1)</span>
          </button>
        </div>
      `
      : `
        <div class="empty-state blank-store-cta">
          <div class="blank-store-icon">${icon('products', 28)}</div>
          <h3 class="empty-title">Sin productos disponibles en caja</h3>
          <p class="empty-subtitle">El catálogo todavía está vacío. Solicita al Dueño que registre los productos e ingrese los lotes iniciales para empezar a vender.</p>
        </div>
      `
  }

  const limit = st.posSearch ? 120 : st.posVisibleLimit || 60
  const visibleProducts = allFiltered.slice(0, limit)
  const remainingCount = Math.max(0, allFiltered.length - visibleProducts.length)

  if (visibleProducts.length === 0) {
    return `
      <div class="empty-state pos-empty-search-state">
        <div class="blank-store-icon">${icon('search', 28)}</div>
        <p class="empty-title">${st.posSearch ? `Sin resultados para "${escapeHTML(st.posSearch)}"` : 'No hay productos disponibles para este criterio'}</p>
        <p class="empty-subtitle">${st.posSearch ? 'Revisa el término escrito o prueba limpiando la búsqueda.' : 'Ajusta el término de búsqueda o cambia la categoría.'}</p>
        ${
          st.posSearch || st.posCategory !== 'ALL'
            ? `<button type="button" class="btn btn-outline btn-sm empty-action-btn" id="btn-pos-reset-filters">Limpiar filtros</button>`
            : ''
        }
      </div>
    `
  }

  return `
    <div class="pos-catalog-grid" id="pos-catalog-grid">
      ${visibleProducts
        .map((p, idx) => {
          const avail = Number(p.available_stock || 0)
          const isOut = avail <= 0
          const isLow = !isOut && p.is_low_stock
          const inCart = st.cart.find((c) => c.product_id === p.id)
          const isSelected = st.posSelectedProductId === p.id

          let stockBadge = `<span class="status-badge badge-success">${formatQty(avail, p.unit)}</span>`
          if (isOut) {
            stockBadge = `<span class="status-badge badge-danger">${icon('alert', 12)} Agotado</span>`
          } else if (isLow) {
            stockBadge = `<span class="status-badge badge-warning">${icon('alert', 12)} Bajo · ${formatQty(avail, p.unit)}</span>`
          }

          const imgSrc =
            p.image_url || buildAestheticFallbackSVG(p.name, p.sku, p.color_tag || 'slate')

          return `
            <button
              type="button"
              class="pos-product-tile ${isOut ? 'tile-disabled' : ''} ${inCart ? 'tile-selected' : ''} ${isSelected ? 'is-selected' : ''}"
              data-pos-tile="${p.id}"
              data-pos-tile-idx="${idx}"
              ${isOut ? 'disabled' : ''}
              aria-label="${escapeHTML(p.name)} - ${formatCOP(p.sale_price)}"
            >
              <div class="tile-top-row">
                ${
                  ui.showThumbnails
                    ? `
                  <div class="tile-thumb-wrap">
                    <img
                      src="${escapeHTML(imgSrc)}"
                      alt="${escapeHTML(p.name)}"
                      class="tile-thumb-img"
                      data-sku="${escapeHTML(p.sku)}"
                      data-color="${escapeHTML(p.color_tag || 'slate')}"
                      loading="lazy"
                      onerror="window.handleProductImageError && window.handleProductImageError(this)"
                    />
                  </div>
                `
                    : ''
                }
                <div class="tile-head-meta">
                  <div class="tile-top">
                    <span class="tile-sku">${escapeHTML(p.sku)}</span>
                    ${stockBadge}
                  </div>
                  <div class="tile-name" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</div>
                  <div class="tile-barcode-sub">${escapeHTML(p.category_name || 'Sin categoría')}${p.barcode ? ` · EAN ${escapeHTML(p.barcode)}` : ''}</div>
                </div>
              </div>
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
    ${
      remainingCount > 0
        ? `
      <div class="catalog-load-more">
        <button type="button" class="btn btn-outline btn-sm" id="btn-pos-load-more">
          Mostrar más productos (${remainingCount} restantes de ${allFiltered.length})
        </button>
      </div>
    `
        : ''
    }
  `
}

export function renderPOSViewHTML(st) {
  const ui = getUISettingsSync()
  const owner = isOwner(st.user)
  const allFiltered = getFilteredPOSProducts(st)
  const rowsHTML = renderPOSCatalogContentHTML(allFiltered, st, ui)

  const categories = st.categories || []
  const { subtotal, total, itemsCount } = calculateCartTotals(st.cart)

  const receivedNum =
    st.paymentMethod === 'efectivo' && st.amountReceived !== ''
      ? Number(st.amountReceived)
      : total
  const changeAmount =
    st.paymentMethod === 'efectivo' && st.amountReceived !== ''
      ? calculateChange(receivedNum, total)
      : 0

  const selectedProd = st.posSelectedProductId
    ? (st.products || []).find((p) => p.id === st.posSelectedProductId)
    : null
  const traySubtotal = selectedProd
    ? roundMoney((st.posSelectedQty || 1) * selectedProd.sale_price)
    : 0


  const cartHTML =
    st.cart.length === 0
      ? `
        <div class="cart-empty-state">
          <p>Sin artículos en el ticket actual</p>
          <small>Toca un producto, presiona / para buscar o usa el escáner.</small>
        </div>
      `
      : st.cart
          .map((item) => {
            const bulk = isBulkUnit(item.unit)
            const lineSubtotal = Math.round(Number(item.unit_price) * Number(item.quantity))
            return `
              <div class="cart-line">
                <div class="cart-line-main">
                  <div class="cart-line-info">
                    <div class="cart-line-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</div>
                    <div class="cart-line-meta">
                      <span>${escapeHTML(item.sku)}</span>
                      <span>·</span>
                      <span>${formatCOP(item.unit_price)} / ${escapeHTML(item.unit)}</span>
                      <span>·</span>
                      <span>Disp: ${formatQty(item.available_stock, item.unit)}</span>
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
                    <button type="button" class="qty-btn" data-cart-dec="${item.product_id}" aria-label="Disminuir cantidad">
                      ${icon('minus', 12)}
                    </button>
                    <input
                      type="number"
                      inputmode="decimal"
                      class="qty-input"
                      step="${bulk ? '0.001' : '1'}"
                      min="${bulk ? '0.001' : '1'}"
                      max="${item.available_stock}"
                      value="${item.quantity}"
                      data-cart-input="${item.product_id}"
                      aria-label="Cantidad de ${escapeHTML(item.name)}"
                    />
                    <button type="button" class="qty-btn" data-cart-inc="${item.product_id}" aria-label="Aumentar cantidad">
                      ${icon('plus', 12)}
                    </button>
                  </div>
                  <div class="cart-line-subtotal">${formatCOP(lineSubtotal)}</div>
                </div>
              </div>
            `
          })
          .join('')

  const tv = st.transferVerification
  const show50vhDock = Boolean(ui.inlineMobileScanner)

  return `
    <div class="pos-layout">
      <!-- Panel Izquierdo: Lector 50% de pantalla opcional + Buscador + Catálogo -->
      <section class="pos-catalog-panel" aria-label="Catálogo de productos disponibles">
        ${
          show50vhDock
            ? `
          <div id="pos-50vh-scanner-dock" class="pos-50vh-scanner-dock" aria-label="Lector de código de barras ocupando el 50% de la pantalla">
            <div class="scanner-50vh-header">
              <div class="scanner-50vh-title">
                ${icon('barcode', 16)}
                <span>Lector de Barras Activo (50% Pantalla)</span>
              </div>
              <button type="button" class="btn btn-ghost btn-xs" id="btn-close-50vh-scanner">
                Cerrar Cámara
              </button>
            </div>
            <div id="pos-50vh-reader-box" class="pos-50vh-reader-box"></div>
            <form id="form-50vh-quick-scan" class="scanner-50vh-footer">
              <input
                id="input-50vh-barcode"
                type="text"
                placeholder="Escanea o escribe código EAN / SKU..."
                value="${escapeHTML((st.products || [])[0]?.barcode || '')}"
              />
              <button type="submit" class="btn btn-primary btn-sm">Registrar</button>
            </form>
          </div>
        `
            : ''
        }

        <header class="panel-toolbar">
          <div class="search-field-wrapper">
            ${icon('search', 16, 'search-icon')}
            <input
              id="pos-search-input"
              type="search"
              value="${escapeHTML(st.posSearch)}"
              placeholder="Buscar producto por nombre, SKU o código de barras..."
              autocomplete="off"
              aria-label="Buscar producto en catálogo"
            />
            <button
              type="button"
              class="search-clear-btn"
              id="btn-pos-clear-search"
              aria-label="Limpiar búsqueda"
              style="display: ${st.posSearch ? 'inline-flex' : 'none'};"
            >
              ${icon('close', 14)}
            </button>
          </div>

          <div class="toolbar-actions">
            <button
              type="button"
              class="btn ${show50vhDock ? 'btn-primary' : 'btn-outline'} btn-sm"
              id="btn-toggle-50vh-scanner"
              title="Activar cámara lectora ocupando el 50% de la pantalla"
            >
              ${icon('camera', 15)}
              <span>Cámara 50%</span>
            </button>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              id="btn-pos-barcode-camera"
              title="Abrir modal de escáner de código de barras"
            >
              ${icon('barcode', 15)}
              <span>Escanear</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-pos-my-sales">
              ${icon('sales', 15)}
              <span class="hide-on-xs">Mis ventas</span>
            </button>
          </div>
        </header>

        <div class="category-filter-bar" role="tablist" aria-label="Filtrar por categoría">
          <button
            type="button"
            class="filter-chip ${st.posCategory === 'ALL' ? 'active' : ''}"
            data-pos-cat="ALL"
          >
            Todos (${(st.products || []).filter((p) => p.is_active).length})
          </button>
          ${categories
            .map(
              (c) => `
              <button
                type="button"
                class="filter-chip ${String(st.posCategory) === String(c.id) ? 'active' : ''}"
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

        ${
          selectedProd
            ? `
          <div class="pos-mobile-selection-tray" id="pos-mobile-selection-tray" role="region" aria-label="Confirmación de selección para el pulgar">
            <div class="pos-tray-prod-row">
              <div class="pos-tray-prod-info">
                <strong class="pos-tray-name">${escapeHTML(selectedProd.name)}</strong>
                <div class="pos-tray-meta">
                  <span>${formatCOP(selectedProd.sale_price)} · Disponible: ${selectedProd.available_stock} ${escapeHTML(selectedProd.unit)}</span>
                </div>
              </div>
              <button type="button" class="btn-icon btn-icon-subtle" id="btn-tray-cancel" aria-label="Cancelar selección">
                ${icon('close', 14)}
              </button>
            </div>

            <div class="pos-tray-controls-row">
              <div class="pos-tray-qty-group">
                <button type="button" class="qty-btn" id="btn-tray-dec" aria-label="Disminuir cantidad">
                  ${icon('minus', 13)}
                </button>
                <span class="pos-tray-qty-val" id="tray-qty-display">${formatQty(st.posSelectedQty || 1, selectedProd.unit)}</span>
                <button type="button" class="qty-btn" id="btn-tray-inc" aria-label="Aumentar cantidad">
                  ${icon('plus', 13)}
                </button>
              </div>

              <button type="button" class="btn btn-primary pos-tray-submit-btn" id="btn-tray-confirm-add">
                ${icon('plus', 16)}
                <span>Agregar al carrito (${formatCOP(traySubtotal)})</span>
              </button>
            </div>
          </div>
        `
            : ''
        }
      </section>

      <!-- Panel Derecho: Ticket, Verificador de Transferencias y Botón Gigante para el Pulgar -->
      <aside class="pos-ticket-panel ${st.mobileTicketOpen ? 'mobile-drawer-open' : ''}" aria-label="Ticket de venta">
        <header class="ticket-header">
          <div class="ticket-header-title-wrap">
            <div class="ticket-title-row">
              <h2 class="ticket-title">Orden de Venta</h2>
              ${itemsCount > 0 ? `<span class="status-badge badge-accent">${itemsCount}</span>` : ''}
            </div>
            <span class="ticket-subtitle">Salida automática por lote (FEFO / FIFO)</span>
          </div>
          <div class="header-actions-group">
            ${
              st.cart.length > 0
                ? `<button type="button" class="btn btn-ghost btn-xs" id="btn-pos-clear-cart">Limpiar</button>`
                : ''
            }
            <button type="button" class="btn-icon mobile-only-close" id="btn-close-mobile-ticket" aria-label="Cerrar ticket">
              ${icon('close', 16)}
            </button>
          </div>
        </header>

        <div class="ticket-lines-container">
          ${cartHTML}
        </div>

        <footer class="ticket-footer">
          <div class="payment-selector">
            <div class="payment-header-row">
              <span class="section-micro-label">Método de pago</span>
              <button
                type="button"
                class="btn btn-outline btn-xs"
                id="btn-verify-transfer"
                title="Capturar foto de transferencia Nequi o Bancolombia con la cámara trasera"
              >
                ${icon('camera', 13)}
                <span>Verificar Transferencia</span>
              </button>
            </div>

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
            tv
              ? `
              <div class="transfer-verified-card">
                <img src="${tv.photo_data_url}" alt="Evidencia transferencia" class="transfer-thumb-mini" />
                <div class="transfer-verified-info">
                  <strong>Transferencia ${escapeHTML(tv.channel)} verificada</strong>
                  <span class="mono">${escapeHTML(tv.timestamp_display)}</span>
                </div>
                <button type="button" class="btn-icon btn-icon-subtle" id="btn-remove-transfer-verif" title="Quitar evidencia">
                  ${icon('close', 13)}
                </button>
              </div>
            `
              : ''
          }

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

          ${
            st.cart.length > 0
              ? `
                <div class="pos-notes-row">
                  <input
                    id="pos-sale-notes"
                    type="text"
                    class="pos-notes-input"
                    value="${escapeHTML(st.saleNotes)}"
                    placeholder="Nota opcional del comprobante (ej. Cliente, domicilio)..."
                    aria-label="Observación opcional de la venta"
                  />
                </div>
              `
              : ''
          }

          <div class="ticket-summary">
            <div class="summary-row">
              <span>Subtotal (${itemsCount} líneas)</span>
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
            class="btn btn-primary btn-block btn-thumb-giant"
            ${st.cart.length === 0 ? 'disabled' : ''}
          >
            ${icon('check', 18)}
            <span>Cobrar Ahora (${formatCOP(total)}) [F2]</span>
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
  const clearSearchBtn = root.querySelector('#btn-pos-clear-search')
  let activeKeyboardIndex = -1
  let isConfirmingTrayAdd = false

  function bindCatalogTiles() {
    const tiles = root.querySelectorAll('[data-pos-tile]')
    tiles.forEach((tile) => {
      let touchStartX = 0
      let touchStartY = 0
      let wasSwipe = false

      tile.addEventListener(
        'touchstart',
        (e) => {
          if (!e.touches || !e.touches[0]) return
          touchStartX = e.touches[0].clientX
          touchStartY = e.touches[0].clientY
          wasSwipe = false
        },
        { passive: true }
      )

      tile.addEventListener(
        'touchmove',
        (e) => {
          if (!e.touches || !e.touches[0]) return
          const dx = Math.abs(e.touches[0].clientX - touchStartX)
          const dy = Math.abs(e.touches[0].clientY - touchStartY)
          if (dx > 8 || dy > 8) {
            wasSwipe = true
          }
        },
        { passive: true }
      )

      tile.addEventListener('click', () => {
        if (wasSwipe) {
          wasSwipe = false
          return
        }
        const pid = tile.getAttribute('data-pos-tile')
        const st = getState()
        const prod = (st.products || []).find((p) => p.id === pid)
        if (!prod) return

        const isMobile = window.matchMedia('(max-width: 900px)').matches
        if (isMobile) {
          // On mobile, tap selects the product and displays thumb-friendly confirmation tray
          setState({ posSelectedProductId: pid, posSelectedQty: 1 })
        } else {
          // On desktop, click adds directly to cart
          const res = addProductToCart(st.cart, prod, 1)
          if (!res.ok) {
            showToast('error', res.error)
            return
          }
          currentOperationId = null
          setState({ cart: res.cart })
        }
      })
    })

    activeKeyboardIndex = -1
  }

  function updateCatalogDom() {
    const st = getState()
    const allFiltered = getFilteredPOSProducts(st)
    const scrollContainer = root.querySelector('.pos-catalog-scroll')
    if (scrollContainer) {
      scrollContainer.innerHTML = renderPOSCatalogContentHTML(
        allFiltered,
        st,
        getUISettingsSync()
      )
      bindCatalogTiles()
    }
    if (clearSearchBtn) {
      clearSearchBtn.style.display = st.posSearch ? 'inline-flex' : 'none'
    }
  }

  bindCatalogTiles()

  // Tray cancellation
  root.querySelector('#btn-tray-cancel')?.addEventListener('click', () => {
    setState({ posSelectedProductId: null, posSelectedQty: 1 })
  })

  // Tray quantity stepper
  root.querySelector('#btn-tray-dec')?.addEventListener('click', () => {
    const st = getState()
    const prod = (st.products || []).find((p) => p.id === st.posSelectedProductId)
    if (!prod) return
    const step = getUnitStep(prod.unit)
    const cur = st.posSelectedQty || 1
    const next = Math.max(step, roundQty(cur - step, prod.unit))
    setState({ posSelectedQty: next })
  })

  root.querySelector('#btn-tray-inc')?.addEventListener('click', () => {
    const st = getState()
    const prod = (st.products || []).find((p) => p.id === st.posSelectedProductId)
    if (!prod) return
    const step = getUnitStep(prod.unit)
    const cur = st.posSelectedQty || 1
    const next = roundQty(cur + step, prod.unit)
    if (next > Number(prod.available_stock || 0)) {
      showToast(
        'error',
        `Existencia máxima alcanzada para "${prod.name}" (${formatQty(prod.available_stock, prod.unit)}).`
      )
      return
    }
    setState({ posSelectedQty: next })
  })

  // Tray confirm add with double-tap protection
  root.querySelector('#btn-tray-confirm-add')?.addEventListener('click', () => {
    if (isConfirmingTrayAdd) return
    isConfirmingTrayAdd = true
    try {
      const st = getState()
      const prod = (st.products || []).find((p) => p.id === st.posSelectedProductId)
      if (!prod) return
      const qty = st.posSelectedQty || 1
      const res = addProductToCart(st.cart, prod, qty)
      if (!res.ok) {
        showToast('error', res.error)
      } else {
        currentOperationId = null
        showToast('ok', `Agregado al ticket: ${prod.name} (${formatQty(qty, prod.unit)})`, 2000)
        setState({ cart: res.cart, posSelectedProductId: null, posSelectedQty: 1 })
      }
    } finally {
      setTimeout(() => {
        isConfirmingTrayAdd = false
      }, 350)
    }
  })

  // Live search without destroying searchInput DOM
  searchInput?.addEventListener('input', (e) => {
    const st = getState()
    st.posSearch = e.target.value
    updateCatalogDom()
  })

  // Keyboard navigation & desktop Enter add
  searchInput?.addEventListener('keydown', (e) => {
    const isMobile = window.matchMedia('(max-width: 900px)').matches
    const tiles = Array.from(root.querySelectorAll('.pos-product-tile:not([disabled])'))

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (tiles.length === 0) return
      activeKeyboardIndex = (activeKeyboardIndex + 1) % tiles.length
      tiles.forEach((t, i) => t.classList.toggle('is-keyboard-focus', i === activeKeyboardIndex))
      tiles[activeKeyboardIndex]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (tiles.length === 0) return
      if (activeKeyboardIndex <= 0) {
        activeKeyboardIndex = -1
        tiles.forEach((t) => t.classList.remove('is-keyboard-focus'))
        searchInput.focus()
      } else {
        activeKeyboardIndex -= 1
        tiles.forEach((t, i) => t.classList.toggle('is-keyboard-focus', i === activeKeyboardIndex))
        tiles[activeKeyboardIndex]?.scrollIntoView({ block: 'nearest' })
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const st = getState()

      if (isMobile) {
        // Mobile Enter: blur keyboard, never auto-add
        searchInput.blur()
        const filtered = getFilteredPOSProducts(st)
        if (filtered.length === 1) {
          setState({ posSelectedProductId: filtered[0].id, posSelectedQty: 1 })
        }
        return
      }

      // Desktop Enter
      if (activeKeyboardIndex >= 0 && tiles[activeKeyboardIndex]) {
        const pid = tiles[activeKeyboardIndex].getAttribute('data-pos-tile')
        const prod = (st.products || []).find((p) => p.id === pid)
        if (prod) {
          const res = addProductToCart(st.cart, prod, 1)
          if (!res.ok) {
            showToast('error', res.error)
          } else {
            showToast('ok', `Agregado: ${prod.name}`, 1500)
            currentOperationId = null
            setState({ cart: res.cart })
          }
        }
        return
      }

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
        currentOperationId = null
        showToast('ok', `Agregado: ${target.name}`, 1500)
        st.posSearch = ''
        if (searchInput) searchInput.value = ''
        setState({ cart: res.cart, posSearch: '' })
      }
    }
  })

  clearSearchBtn?.addEventListener('click', () => {
    const st = getState()
    st.posSearch = ''
    if (searchInput) {
      searchInput.value = ''
      searchInput.focus()
    }
    updateCatalogDom()
    setState({ posSearch: '' }, false)
  })

  root.querySelector('#btn-pos-reset-filters')?.addEventListener('click', () => {
    const st = getState()
    st.posSearch = ''
    if (searchInput) searchInput.value = ''
    setState({ posSearch: '', posCategory: 'ALL', posVisibleLimit: 60 })
    document.querySelector('#pos-search-input')?.focus()
  })

  root.querySelector('#btn-empty-pos-create-first')?.addEventListener('click', () => {
    if (!isOwner(getState().user)) {
      showToast('error', 'Solo el Dueño puede crear productos.')
      return
    }
    openProductFormModal(null, refreshCatalogAndContext)
  })

  root.querySelector('#btn-pos-barcode-camera')?.addEventListener('click', () => {
    openBarcodeScannerModal()
  })

  root.querySelector('#btn-toggle-50vh-scanner')?.addEventListener('click', async () => {
    const cur = getUISettingsSync()
    const next = !cur.inlineMobileScanner
    if (!next) {
      await stopInline50vhScanner()
    }
    saveUISettingsSync({ inlineMobileScanner: next })
    setState({})
  })

  root.querySelector('#btn-close-50vh-scanner')?.addEventListener('click', async () => {
    await stopInline50vhScanner()
    saveUISettingsSync({ inlineMobileScanner: false })
    setState({})
  })

  root.querySelector('#form-50vh-quick-scan')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const code = root.querySelector('#input-50vh-barcode')?.value
    handleScannedCode(code)
  })

  // Si el dock 50% de pantalla está activo, inicializar cámara en #pos-50vh-reader-box
  const dockReader = root.querySelector('#pos-50vh-reader-box')
  if (dockReader && typeof window.Html5Qrcode === 'function' && !inlineScannerRunning) {
    try {
      inlineHtml5Scanner = new window.Html5Qrcode('pos-50vh-reader-box')
      inlineHtml5Scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 110 } },
          (decodedText) => {
            handleScannedCode(decodedText)
          },
          () => {}
        )
        .then(() => {
          inlineScannerRunning = true
        })
        .catch(() => {
          dockReader.innerHTML = `<div class="scanner-fallback-msg">Visor 50vh activo (usa el campo inferior si tu equipo no tiene cámara conectada).</div>`
        })
    } catch {
      dockReader.innerHTML = `<div class="scanner-fallback-msg">Visor 50vh activo.</div>`
    }
  }

  root.querySelector('#btn-close-mobile-ticket')?.addEventListener('click', () => {
    setState({ mobileTicketOpen: false })
  })

  root.querySelector('#btn-verify-transfer')?.addEventListener('click', () => {
    const { total } = calculateCartTotals(getState().cart)
    openTransferVerifierModal(total)
  })

  root.querySelector('#btn-remove-transfer-verif')?.addEventListener('click', () => {
    setState({ transferVerification: null })
  })

  root.querySelector('#btn-pos-load-more')?.addEventListener('click', () => {
    const cur = getState().posVisibleLimit || 60
    setState({ posVisibleLimit: cur + 80 })
  })

  root.querySelectorAll('[data-pos-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ posCategory: btn.getAttribute('data-pos-cat'), posVisibleLimit: 60 })
    })
  })

  root.querySelectorAll('[data-cart-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-cart-inc')
      const st = getState()
      const prod = st.products.find((p) => p.id === pid)
      if (!prod) return
      const step = getUnitStep(prod.unit)
      const res = addProductToCart(st.cart, prod, step)
      if (!res.ok) showToast('error', res.error)
      currentOperationId = null
      setState({ cart: res.cart })
    })
  })

  root.querySelectorAll('[data-cart-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-cart-dec')
      const st = getState()
      const item = st.cart.find((c) => c.product_id === pid)
      if (!item) return
      const step = getUnitStep(item.unit)
      const next = updateCartItemQty(st.cart, pid, item.quantity - step)
      currentOperationId = null
      setState({ cart: next })
    })
  })

  root.querySelectorAll('[data-cart-input]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const pid = input.getAttribute('data-cart-input')
      const st = getState()
      const prod = st.products.find((p) => p.id === pid)
      const requested = Number(e.target.value)
      if (prod && Number.isFinite(requested) && requested > Number(prod.available_stock || 0)) {
        showToast(
          'error',
          `Existencia máxima alcanzada para "${prod.name}" (${formatQty(prod.available_stock, prod.unit)}).`
        )
      }
      const next = updateCartItemQty(st.cart, pid, e.target.value, prod?.available_stock)
      currentOperationId = null
      setState({ cart: next })
    })
  })

  root.querySelectorAll('[data-cart-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-cart-remove')
      currentOperationId = null
      setState({ cart: removeCartItem(getState().cart, pid) })
    })
  })

  root.querySelector('#btn-pos-clear-cart')?.addEventListener('click', () => {
    currentOperationId = null
    setState({ cart: [], amountReceived: '', saleNotes: '', transferVerification: null })
  })

  root.querySelectorAll('[data-pos-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const method = btn.getAttribute('data-pos-pay')
      setState({ paymentMethod: method })
      if (method === 'nequi' || method === 'bancolombia') {
        const st = getState()
        if (st.cart.length > 0 && !st.transferVerification) {
          const { total } = calculateCartTotals(st.cart)
          openTransferVerifierModal(total)
        }
      }
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
    if (el) {
      el.focus()
    }
  })

  root.querySelector('#pos-sale-notes')?.addEventListener('input', (e) => {
    setState({ saleNotes: e.target.value }, false)
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

  const ui = getUISettingsSync()
  const { total } = calculateCartTotals(st.cart)

  if (
    ui.requireTransferPhoto &&
    (st.paymentMethod === 'nequi' || st.paymentMethod === 'bancolombia') &&
    !st.transferVerification
  ) {
    showToast(
      'error',
      'Debes capturar la foto de verificación de transferencia antes de confirmar la venta.'
    )
    openTransferVerifierModal(total)
    return
  }

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
      notes: st.saleNotes || '',
      transfer_verification: st.transferVerification || null,
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
        saleNotes: '',
        transferVerification: null,
        mobileTicketOpen: false,
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
                <td>
                  <span class="status-badge badge-neutral">${escapeHTML(s.payment_method_name)}</span>
                  ${s.transfer_verification ? `<span class="status-badge badge-success">Foto verificada</span>` : ''}
                </td>
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
