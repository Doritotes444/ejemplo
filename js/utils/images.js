/**
 * Compresión de imágenes con Canvas nativo y generación de avatares SVG sin dependencias.
 * Rescatado de offlineDB.js (comprimirImagenArchivo).
 */

export function comprimirImagenArchivo(file, maxWidth = 480, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ningún archivo'))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / Math.max(img.width, img.height, 1))
        const w = Math.max(1, Math.round(img.width * ratio))
        const h = Math.max(1, Math.round(img.height * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => resolve(e.target.result)
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

export function generarPlaceholderSVG(nombre = 'Producto', categoria = '') {
  const iniciales = String(nombre || 'PR')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'PR'

  const colores = {
    Granos: ['#dcfce7', '#15803d'],
    Lacteos: ['#dbeafe', '#1d4ed8'],
    Abarrotes: ['#fef3c7', '#b45309'],
    Bebidas: ['#fee2e2', '#b91c1c'],
    Aseo: ['#e0e7ff', '#4338ca'],
    Snacks: ['#fae8ff', '#a21caf'],
  }
  const [bg, fg] = colores[categoria] || ['#f1f5f9', '#334155']

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <rect width="160" height="160" rx="20" fill="${bg}"/>
    <text x="80" y="92" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="42" font-weight="700" fill="${fg}">${iniciales}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function resolverFotoProducto(producto) {
  if (producto?.foto_url && String(producto.foto_url).startsWith('data:image/')) {
    return producto.foto_url
  }
  return generarPlaceholderSVG(producto?.nombre, producto?.categoria)
}
