import { formatCOP } from '../utils/money.js'
import { formatQty } from '../utils/quantities.js'
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

  const dateStr = new Date(sale.created_at).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const linesHTML = (sale.items || [])
    .map((item) => {
      const lotsTag = (item.lots || [])
        .map((l) => `${escapeHTML(l.lot_number)} (${l.quantity})`)
        .join(', ')
      return `
        <tr>
          <td>
            <div class="receipt-prod-name">${escapeHTML(item.product_name)}</div>
            <div class="receipt-prod-meta">SKU: ${escapeHTML(item.sku)} ${lotsTag ? `· Lote: ${lotsTag}` : ''}</div>
          </td>
          <td class="num">${formatQty(item.quantity, item.unit)}</td>
          <td class="num">${formatCOP(item.unit_price)}</td>
          <td class="num"><strong>${formatCOP(item.subtotal)}</strong></td>
        </tr>
      `
    })
    .join('')

  openDialog({
    title: `Comprobante de Venta · ${escapeHTML(sale.folio)}`,
    subtitle: 'Transacción confirmada y descontada del inventario.',
    maxWidth: '520px',
    bodyHTML: `
      <div id="printable-receipt" class="receipt-sheet">
        <div class="receipt-header">
          <div class="receipt-brand">KAIRO POS</div>
          <div class="receipt-folio">Folio: <strong>${escapeHTML(sale.folio)}</strong></div>
          <div class="receipt-meta">Fecha: ${escapeHTML(dateStr)}</div>
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
      modal.querySelector('#btn-print-receipt')?.addEventListener('click', () => {
        window.print()
      })
    },
  })
}
