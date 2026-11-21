import { formatCOP } from '../utils/money.js'
import { formatQty } from '../utils/quantities.js'
import { getStoredProfileSync } from '../core/localStore.js'
import { openDialog } from './dialog.js'
import { icon } from './icons.js'

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function openSaleReceiptModal(sale) {
  if (!sale) return

  const store = sale.store_snapshot || getStoredProfileSync()
  const dateStr = new Date(sale.created_at).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })

  const linesHTML = (sale.items || [])
    .map((item) => {
      const lotArr = item.allocations || item.lots || []
      const lotsTag = lotArr
        .map((l) => `${escapeHTML(l.lot_number)} (-${l.quantity})`)
        .join(', ')
      return `
        <tr>
          <td>
            <div class="receipt-prod-name">${escapeHTML(item.product_name)}</div>
            <div class="receipt-prod-meta">SKU: ${escapeHTML(item.product_sku || item.sku || '')} ${lotsTag ? `· Lote: ${lotsTag}` : ''}</div>
          </td>
          <td class="num">${formatQty(item.quantity, item.unit)}</td>
          <td class="num">${formatCOP(item.unit_price)}</td>
          <td class="num"><strong>${formatCOP(item.subtotal)}</strong></td>
        </tr>
      `
    })
    .join('')

  const tv = sale.transfer_verification

  openDialog({
    title: `Comprobante de Venta · ${escapeHTML(sale.folio)}`,
    subtitle: 'Transacción confirmada y descontada del inventario.',
    maxWidth: '520px',
    bodyHTML: `
      <div id="printable-receipt" class="receipt-sheet">
        <div class="receipt-header">
          <div class="receipt-brand">${escapeHTML(store?.store_name || 'KAIRO POS')}</div>
          ${
            store
              ? `<div class="receipt-meta">NIT: ${escapeHTML(store.nit)} · ${escapeHTML(store.address)} (${escapeHTML(store.neighborhood)})</div>`
              : ''
          }
          <div class="receipt-folio">Folio: <strong>${escapeHTML(sale.folio)}</strong></div>
          <div class="receipt-meta">Fecha y hora: ${escapeHTML(dateStr)}</div>
          <div class="receipt-meta">Atendido por: ${escapeHTML(sale.seller_name)} (@${escapeHTML(sale.seller_username)})</div>
          <div class="receipt-meta">Método de pago: <strong>${escapeHTML(sale.payment_method_name)}</strong></div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th class="num">Cant.</th>
              <th class="num">Unit.</th>
              <th class="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${linesHTML}
          </tbody>
        </table>

        <div class="receipt-totals">
          <div class="receipt-total-line">
            <span>Subtotal</span>
            <span>${formatCOP(sale.subtotal)}</span>
          </div>
          <div class="receipt-total-line main">
            <span>Total Pagado</span>
            <strong>${formatCOP(sale.total)}</strong>
          </div>
          <div class="receipt-total-line">
            <span>Monto Recibido</span>
            <span>${formatCOP(sale.amount_received)}</span>
          </div>
          ${
            sale.payment_method === 'efectivo'
              ? `
            <div class="receipt-total-line">
              <span>Cambio Entregado</span>
              <strong>${formatCOP(sale.change_amount)}</strong>
            </div>
          `
              : ''
          }
        </div>

        ${
          tv && tv.photo_data_url
            ? `
            <div class="receipt-verification-box">
              <div class="fieldset-title">Evidencia Fotográfica de Transferencia (${escapeHTML(tv.channel)})</div>
              <img src="${tv.photo_data_url}" alt="Evidencia de transferencia" class="receipt-verification-img" />
              <div class="receipt-meta mono">Timestamp captura: ${escapeHTML(tv.timestamp_display || tv.timestamp)}</div>
            </div>
          `
            : ''
        }

        ${sale.notes ? `<div class="receipt-notes">Observación: ${escapeHTML(sale.notes)}</div>` : ''}
      </div>

      <div class="dialog-actions">
        <button type="button" class="btn btn-outline" id="btn-print-receipt">
          ${icon('printer', 15)}
          <span>Imprimir Comprobante</span>
        </button>
        <button type="button" class="btn btn-primary" data-dialog-close>Cerrar</button>
      </div>
    `,
    onMount(modal) {
      let isPrinting = false
      modal.querySelector('#btn-print-receipt')?.addEventListener('click', () => {
        if (isPrinting) return
        isPrinting = true

        const receiptEl = modal.querySelector('#printable-receipt')
        let printRoot = document.getElementById('print-root')
        if (!printRoot) {
          printRoot = document.createElement('div')
          printRoot.id = 'print-root'
          printRoot.setAttribute('aria-hidden', 'true')
          document.body.appendChild(printRoot)
        }

        printRoot.innerHTML = receiptEl ? receiptEl.outerHTML : ''

        const cleanup = () => {
          window.removeEventListener('afterprint', cleanup)
          if (printRoot) printRoot.innerHTML = ''
          isPrinting = false
        }
        window.addEventListener('afterprint', cleanup)

        try {
          window.print()
        } catch {
          cleanup()
        }
      })
    },
  })
}

