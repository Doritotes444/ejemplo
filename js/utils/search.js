/**
 * js/utils/search.js — Normalización de texto y ordenamiento por relevancia para búsquedas.
 * - Búsqueda insensible a mayúsculas, minúsculas y acentos/diacríticos.
 * - Clasificación por relevancia:
 *   1. Coincidencia exacta de Código de barras o SKU (1000)
 *   2. Código de barras o SKU comienza por la consulta (800)
 *   3. Nombre del producto comienza por la consulta (600)
 *   4. Una palabra del nombre comienza por la consulta (400)
 *   5. Nombre del producto contiene la consulta (200)
 *   6. Código de barras o SKU contiene la consulta (100)
 */

export function normalizeSearch(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function scoreProductSearch(product, rawQuery) {
  const q = normalizeSearch(rawQuery)
  if (!q) return 0

  const barcodeNorm = normalizeSearch(product?.barcode)
  const skuNorm = normalizeSearch(product?.sku)
  const nameNorm = normalizeSearch(product?.name)

  // 1. Coincidencia exacta en código de barras o SKU
  if (barcodeNorm === q || skuNorm === q) {
    return 1000
  }

  // 2. Prefijo en código de barras o SKU
  if (barcodeNorm.startsWith(q) || skuNorm.startsWith(q)) {
    return 800
  }

  // 3. Prefijo en el nombre del producto
  if (nameNorm.startsWith(q)) {
    return 600
  }

  // 4. Prefijo en alguna palabra del nombre
  const words = nameNorm.split(/\s+/)
  if (words.some((w) => w.startsWith(q))) {
    return 400
  }

  // 5. Contenido en el nombre del producto
  if (nameNorm.includes(q)) {
    return 200
  }

  // 6. Contenido en código de barras o SKU
  if (barcodeNorm.includes(q) || skuNorm.includes(q)) {
    return 100
  }

  return -1
}

export function filterAndRankProducts(products = [], rawQuery = '') {
  const q = normalizeSearch(rawQuery)
  if (!q) return products

  const scored = []
  for (const p of products) {
    const score = scoreProductSearch(p, q)
    if (score >= 0) {
      scored.push({ product: p, score })
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return String(a.product.name || '').localeCompare(String(b.product.name || ''), 'es', {
      sensitivity: 'base',
    })
  })

  return scored.map((item) => item.product)
}
