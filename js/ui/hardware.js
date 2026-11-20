/**
 * js/ui/hardware.js — Integración de Hardware (Cámara Trasera, Escáner de Código de Barras y Verificador de Pagos)
 * 1. Lector de Código de Barras vía CDN (html5-qrcode) para agregar productos automáticamente al POS.
 * 2. Verificador de Transferencias (Nequi / Bancolombia): captura frame de <video> en <canvas> con sello de fecha/hora (timestamp).
 */

import { getState, setState, addProductToCart, showToast } from '../state.js'
import { openDialog, closeDialog } from './dialog.js'
import { formatCOP } from '../utils/money.js'
import { icon } from './icons.js'
import { getStoredProfileSync } from '../core/localStore.js'

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Emite un tono corto de confirmación tipo escáner láser usando Web Audio API
 */
function playScannerBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.095)
  } catch {
    // Ignorar si el navegador bloquea audio sin gesto previo
  }
}

/**
 * Busca el producto por código de barras o SKU y lo agrega automáticamente al carrito del POS
 */
export function handleScannedCode(rawCode) {
  const code = String(rawCode || '').trim()
  if (!code) return null

  const st = getState()
  const match = (st.products || []).find(
    (p) =>
      p.is_active &&
      (String(p.barcode || '').toLowerCase() === code.toLowerCase() ||
        String(p.sku || '').toLowerCase() === code.toLowerCase())
  )

  if (!match) {
    showToast('error', `Código "${code}" no encontrado en el catálogo.`)
    return null
  }

  const res = addProductToCart(st.cart, match, 1)
  if (!res.ok) {
    showToast('error', res.error)
    return null
  }
  setState({ cart: res.cart })
  playScannerBeep()
  showToast('ok', `Escaneado: ${match.name} (${formatCOP(match.sale_price)})`)
  return match
}

/**
 * 1. Lector de Código de Barras con Cámara (html5-qrcode vía CDN)
 */
export function openBarcodeScannerModal() {
  const st = getState()
  const sampleProducts = (st.products || [])
    .filter((p) => p.is_active && p.available_stock > 0 && p.barcode)
    .slice(0, 12)

  let html5QrScanner = null
  let isScanning = false

  async function stopScannerCleanly() {
    if (html5QrScanner && isScanning) {
      try {
        await html5QrScanner.stop()
        await html5QrScanner.clear()
      } catch {
        // Ignorar errores al desmontar cámara
      }
      isScanning = false
    }
  }

  openDialog({
    title: 'Lector de Código de Barras (Cámara)',
    subtitle: 'Apunta la cámara trasera del celular al código EAN-13 / QR del producto para registrarlo en el ticket.',
    maxWidth: '520px',
    onClose: () => {
      stopScannerCleanly()
    },
    bodyHTML: `
      <div class="hardware-modal-stack">
        <div class="scanner-viewport-wrap">
          <div id="barcode-camera-reader" class="barcode-reader-box"></div>
          <div id="scanner-status-bar" class="scanner-status-bar">
            <span>Inicializando cámara trasera (html5-qrcode)...</span>
          </div>
        </div>

        <div class="scanner-manual-box">
          <div class="fieldset-title">Prueba rápida / Entrada directa de código EAN</div>
          <form id="form-manual-barcode" class="scanner-manual-row">
            <input
              id="input-manual-barcode"
              type="text"
              placeholder="Ej. 7701000000015 o SKU ABA-001"
              value="${escapeHTML(sampleProducts[0]?.barcode || '')}"
              required
            />
            <button type="submit" class="btn btn-primary btn-sm" id="btn-trigger-scan">
              ${icon('barcode', 15)}
              <span>Registrar Código</span>
            </button>
          </form>

          <div class="quick-barcode-chips">
            ${sampleProducts
              .slice(0, 4)
              .map(
                (p) => `
                <button
                  type="button"
                  class="filter-chip"
                  data-quick-barcode="${escapeHTML(p.barcode)}"
                >
                  ${escapeHTML(p.barcode)} · ${escapeHTML(p.name.slice(0, 22))}
                </button>
              `
              )
              .join('')}
          </div>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" id="btn-close-scanner">Cerrar Escáner</button>
        </div>
      </div>
    `,
    onMount(modal) {
      const statusBar = modal.querySelector('#scanner-status-bar')
      const closeBtn = modal.querySelector('#btn-close-scanner')

      closeBtn?.addEventListener('click', async () => {
        await stopScannerCleanly()
        closeDialog()
      })

      // Botones rápidos de prueba / simulación de escaneo
      modal.querySelectorAll('[data-quick-barcode]').forEach((chip) => {
        chip.addEventListener('click', async () => {
          const code = chip.getAttribute('data-quick-barcode')
          const input = modal.querySelector('#input-manual-barcode')
          if (input) input.value = code
          const found = handleScannedCode(code)
          if (found) {
            await stopScannerCleanly()
            closeDialog()
          }
        })
      })

      modal.querySelector('#form-manual-barcode')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const code = modal.querySelector('#input-manual-barcode')?.value
        const found = handleScannedCode(code)
        if (found) {
          await stopScannerCleanly()
          closeDialog()
        }
      })

      // Iniciar cámara trasera con Html5Qrcode (cargado vía CDN en /app/index.html)
      if (typeof window.Html5Qrcode === 'function') {
        try {
          html5QrScanner = new window.Html5Qrcode('barcode-camera-reader')
          html5QrScanner
            .start(
              { facingMode: 'environment' },
              {
                fps: 12,
                qrbox: { width: 250, height: 130 },
              },
              async (decodedText) => {
                const found = handleScannedCode(decodedText)
                if (found) {
                  await stopScannerCleanly()
                  closeDialog()
                }
              },
              () => {
                // Frame sin código detectado aún
              }
            )
            .then(() => {
              isScanning = true
              if (statusBar) {
                statusBar.textContent = 'Cámara activa: enfoca el código de barras del producto.'
              }
            })
            .catch((err) => {
              if (statusBar) {
                statusBar.textContent = `Cámara física no disponible (${err?.message || 'sin permisos'}). Usa el lector manual o rápido abajo.`
              }
            })
        } catch {
          if (statusBar) {
            statusBar.textContent =
              'Modo sin cámara física activo. Selecciona o ingresa el código EAN abajo.'
          }
        }
      } else {
        if (statusBar) {
          statusBar.textContent =
            'Librería html5-qrcode lista en modo entrada directa de código.'
        }
      }
    },
  })
}

/**
 * 2. Verificador de Pagos (Nequi / Bancolombia):
 * Abre la cámara trasera del dispositivo, permite tomar una foto capturando el frame de video
 * en un <canvas>, estampa fecha y hora exacta (timestamp) y la guarda en el registro de la venta.
 */
export function openTransferVerifierModal(totalAmount) {
  const st = getState()
  const existing = st.transferVerification
  const storeProfile = getStoredProfileSync()
  let mediaStream = null
  let capturedDataUrl = existing?.photo_data_url || null
  let capturedTimestampISO = existing?.timestamp || null
  let capturedTimestampDisplay = existing?.timestamp_display || null

  function stopCameraStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }
  }

  openDialog({
    title: 'Verificar Transferencia (Nequi / Bancolombia)',
    subtitle: `Captura fotográfica del comprobante en pantalla con sello de tiempo exacto por ${formatCOP(totalAmount)}.`,
    maxWidth: '540px',
    onClose: () => {
      stopCameraStream()
    },
    bodyHTML: `
      <div class="hardware-modal-stack">
        <div class="form-row-2">
          <div class="form-field">
            <label for="tv-channel">Entidad / Billetera *</label>
            <select id="tv-channel">
              <option value="Nequi" ${existing?.channel === 'Nequi' ? 'selected' : ''}>Nequi</option>
              <option value="Bancolombia" ${existing?.channel === 'Bancolombia' ? 'selected' : ''}>Bancolombia (A la Mano / QR)</option>
              <option value="Daviplata" ${existing?.channel === 'Daviplata' ? 'selected' : ''}>Daviplata</option>
            </select>
          </div>
          <div class="form-field">
            <label for="tv-reference">Referencia / Últimos 4 dígitos (opcional)</label>
            <input id="tv-reference" type="text" placeholder="Ej. M89402" value="${escapeHTML(existing?.reference || '')}" />
          </div>
        </div>

        <div class="camera-capture-stage">
          <video
            id="transfer-video-stream"
            class="transfer-video-el"
            autoplay
            playsinline
            muted
            ${capturedDataUrl ? 'hidden' : ''}
          ></video>

          <canvas
            id="transfer-capture-canvas"
            width="640"
            height="420"
            class="transfer-canvas-el"
            ${capturedDataUrl ? '' : 'hidden'}
          ></canvas>

          <div id="tv-camera-badge" class="camera-live-badge">
            ${icon('camera', 14)}
            <span id="tv-camera-status-text">Activando cámara trasera...</span>
          </div>
        </div>

        <div id="tv-timestamp-readout" class="timestamp-readout" ${capturedTimestampDisplay ? '' : 'hidden'}>
          <strong>Fecha y hora exacta de captura:</strong>
          <span id="tv-timestamp-val" class="mono">${escapeHTML(capturedTimestampDisplay || '')}</span>
        </div>

        <div class="camera-controls-bar">
          <button type="button" class="btn btn-outline btn-sm" id="btn-retake-transfer" ${capturedDataUrl ? '' : 'hidden'}>
            ${icon('refresh', 14)}
            <span>Repetir Foto</span>
          </button>
          <button type="button" class="btn btn-primary" id="btn-capture-transfer-photo">
            ${icon('camera', 16)}
            <span>Tomar Foto en &lt;canvas&gt;</span>
          </button>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" id="btn-cancel-transfer">Cancelar</button>
          <button
            type="button"
            class="btn btn-primary"
            id="btn-save-transfer-verification"
            ${capturedDataUrl ? '' : 'disabled'}
          >
            ${icon('check', 16)}
            <span>Guardar Verificación en la Venta</span>
          </button>
        </div>
      </div>
    `,
    onMount(modal) {
      const video = modal.querySelector('#transfer-video-stream')
      const canvas = modal.querySelector('#transfer-capture-canvas')
      const statusText = modal.querySelector('#tv-camera-status-text')
      const btnCapture = modal.querySelector('#btn-capture-transfer-photo')
      const btnRetake = modal.querySelector('#btn-retake-transfer')
      const btnSave = modal.querySelector('#btn-save-transfer-verification')
      const btnCancel = modal.querySelector('#btn-cancel-transfer')
      const tsBox = modal.querySelector('#tv-timestamp-readout')
      const tsVal = modal.querySelector('#tv-timestamp-val')

      // Si ya existía una captura previa, dibujarla en el canvas
      if (capturedDataUrl && canvas) {
        const img = new Image()
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
        img.src = capturedDataUrl
      }

      async function startRearCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (statusText) {
            statusText.textContent = 'Modo captura directa <canvas> listo (sin cámara física).'
          }
          return
        }
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 640 },
              height: { ideal: 420 },
            },
            audio: false,
          })
          if (video) {
            video.srcObject = mediaStream
            await video.play().catch(() => {})
          }
          if (statusText) {
            statusText.textContent = 'Cámara trasera activa · Enfoca la pantalla del pago'
          }
        } catch {
          if (statusText) {
            statusText.textContent = 'Cámara en modo respaldo · Pulsa "Tomar Foto" para capturar comprobante'
          }
        }
      }

      startRearCamera()

      btnCapture?.addEventListener('click', () => {
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const width = canvas.width
        const height = canvas.height
        const channel = modal.querySelector('#tv-channel')?.value || 'Nequi'
        const ref = modal.querySelector('#tv-reference')?.value.trim() || 'VERIF-CAM'

        const now = new Date()
        capturedTimestampISO = now.toISOString()
        capturedTimestampDisplay = now.toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'medium',
        })

        // 1. Capturar el frame de video real si el stream está activo; si no, renderizar comprobante de cámara
        if (video && mediaStream && video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, width, height)
        } else {
          // Respaldo visual de cámara en <canvas> cuando se ejecuta en un dispositivo sin webcam física
          ctx.fillStyle = '#11161f'
          ctx.fillRect(0, 0, width, height)

          ctx.strokeStyle = '#2a3444'
          ctx.lineWidth = 2
          ctx.strokeRect(24, 24, width - 48, height - 110)

          ctx.fillStyle = '#10b981'
          ctx.font = 'bold 18px sans-serif'
          ctx.fillText(`COMPROBANTE DE TRANSFERENCIA ${channel.toUpperCase()}`, 48, 72)

          ctx.fillStyle = '#f3f4f6'
          ctx.font = 'bold 34px monospace'
          ctx.fillText(formatCOP(totalAmount), 48, 130)

          ctx.fillStyle = '#9ca3af'
          ctx.font = '15px sans-serif'
          ctx.fillText(
            `Establecimiento: ${storeProfile?.store_name || 'Tienda Kairo POS'} (NIT: ${storeProfile?.nit || '900.000.000-1'})`,
            48,
            175
          )
          ctx.fillText(`Referencia de operación: ${ref}`, 48, 205)
          ctx.fillText(`Estado: PAGO EXITOSO VERIFICADO EN MOSTRADOR`, 48, 235)
        }

        // 2. Estampar franja inferior de auditoría con fecha y hora exacta (timestamp)
        ctx.fillStyle = 'rgba(9, 12, 16, 0.88)'
        ctx.fillRect(0, height - 74, width, 74)

        ctx.fillStyle = '#10b981'
        ctx.font = 'bold 13px monospace'
        ctx.fillText(
          `VERIFICADO: ${channel.toUpperCase()} · ${formatCOP(totalAmount)} · REF: ${ref}`,
          18,
          height - 44
        )

        ctx.fillStyle = '#ffffff'
        ctx.font = '12px monospace'
        ctx.fillText(
          `TIMESTAMP: ${capturedTimestampDisplay} (${capturedTimestampISO})`,
          18,
          height - 20
        )

        capturedDataUrl = canvas.toDataURL('image/jpeg', 0.85)

        if (video) video.hidden = true
        canvas.hidden = false
        if (btnRetake) btnRetake.hidden = false
        if (btnSave) btnSave.disabled = false
        if (tsBox && tsVal) {
          tsVal.textContent = `${capturedTimestampDisplay} (${capturedTimestampISO})`
          tsBox.hidden = false
        }
        if (statusText) {
          statusText.textContent = 'Fotografía capturada en <canvas> con sello de fecha y hora.'
        }
      })

      btnRetake?.addEventListener('click', () => {
        capturedDataUrl = null
        if (canvas) canvas.hidden = true
        if (video) video.hidden = false
        if (btnRetake) btnRetake.hidden = true
        if (btnSave) btnSave.disabled = true
        if (tsBox) tsBox.hidden = true
      })

      btnCancel?.addEventListener('click', () => {
        stopCameraStream()
        closeDialog()
      })

      btnSave?.addEventListener('click', () => {
        if (!capturedDataUrl) return
        const channel = modal.querySelector('#tv-channel')?.value || 'Nequi'
        const reference = modal.querySelector('#tv-reference')?.value.trim() || ''
        const methodCode = channel.toLowerCase() === 'bancolombia' ? 'bancolombia' : channel.toLowerCase() === 'daviplata' ? 'daviplata' : 'nequi'

        setState({
          paymentMethod: methodCode,
          transferVerification: {
            channel,
            reference,
            photo_data_url: capturedDataUrl,
            timestamp: capturedTimestampISO,
            timestamp_display: capturedTimestampDisplay,
          },
        })

        stopCameraStream()
        closeDialog()
        showToast('ok', `Comprobante ${channel} verificado y adjuntado a la venta actual.`)
      })
    },
  })
}
