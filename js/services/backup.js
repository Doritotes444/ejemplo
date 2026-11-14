import {
  STORES,
  getAllFromStore,
  putManyInStores,
  clearAllStores,
} from '../core/db.js'
import { assertOwnerPermission, ROLES } from '../core/permissions.js'
import { DEFAULT_TIENDA_ID } from '../core/session.js'
import { getTodayISO, sumarDiasISO } from './seedHelper.js'

/**
 * Servicio de Respaldo Local (Exportación / Importación JSON) y Semilla Demo Inicial.
 * Garantiza que la tienda tenga un catálogo colombiano realista con múltiples lotes FIFO
 * desde la primera vez que se abre en el navegador.
 */

export async function exportBackupJSON(tiendaId = DEFAULT_TIENDA_ID) {
  const [productos, lotes, ventas, movimientos] = await Promise.all([
    getAllFromStore(STORES.PRODUCTOS, tiendaId),
    getAllFromStore(STORES.LOTES, tiendaId),
    getAllFromStore(STORES.VENTAS, tiendaId),
    getAllFromStore(STORES.MOVIMIENTOS, tiendaId),
  ])

  return {
    version: '2.0-vanilla-fifo',
    exported_at: new Date().toISOString(),
    tienda_id: tiendaId,
    data: {
      productos,
      lotes,
      ventas,
      movimientos,
    },
  }
}

export async function importBackupJSON(backupPayload, user) {
  assertOwnerPermission(user, 'importar respaldos de base de datos')
  const data = backupPayload?.data
  if (!data || !Array.isArray(data.productos) || !Array.isArray(data.lotes)) {
    throw new Error('El archivo de respaldo no tiene el formato válido de Tiendapp FIFO.')
  }

  await clearAllStores()

  const ops = []
  for (const p of data.productos) ops.push({ store: STORES.PRODUCTOS, record: p })
  for (const l of data.lotes) ops.push({ store: STORES.LOTES, record: l })
  for (const v of data.ventas || []) ops.push({ store: STORES.VENTAS, record: v })
  for (const m of data.movimientos || []) ops.push({ store: STORES.MOVIMIENTOS, record: m })

  await putManyInStores(ops)
  return {
    productos: data.productos.length,
    lotes: data.lotes.length,
    ventas: (data.ventas || []).length,
  }
}

export async function ensureDemoDataIfEmpty(tiendaId = DEFAULT_TIENDA_ID) {
  const existing = await getAllFromStore(STORES.PRODUCTOS, tiendaId)
  if (existing.length > 0) return false
  await resetToDemoCatalog(tiendaId)
  return true
}

export async function resetToDemoCatalog(tiendaId = DEFAULT_TIENDA_ID) {
  await clearAllStores()

  const hoy = getTodayISO()
  const hace10Dias = sumarDiasISO(hoy, -10)
  const hace4Dias = sumarDiasISO(hoy, -4)
  const hace2Dias = sumarDiasISO(hoy, -2)
  const en5Dias = sumarDiasISO(hoy, 5)
  const en15Dias = sumarDiasISO(hoy, 15)
  const en45Dias = sumarDiasISO(hoy, 45)
  const en120Dias = sumarDiasISO(hoy, 120)
  const vencidoAyer = sumarDiasISO(hoy, -1)

  const nowISO = new Date().toISOString()

  const productosDemo = [
    {
      id: 'prd-arroz-diana',
      tienda_id: tiendaId,
      nombre: 'Arroz Diana 500g',
      codigo_barras: '7702001001',
      categoria: 'Granos',
      unidad_medida: 'unidad',
      precio_venta: 2800,
      stock_minimo: 10,
      es_frecuente: true,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'prd-leche-alqueria',
      tienda_id: tiendaId,
      nombre: 'Leche Alquería Entera 1L',
      codigo_barras: '7702001002',
      categoria: 'Lacteos',
      unidad_medida: 'unidad',
      precio_venta: 4600,
      stock_minimo: 8,
      es_frecuente: true,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'prd-huevos-aa',
      tienda_id: tiendaId,
      nombre: 'Cubeta Huevos AA x30',
      codigo_barras: '7702001003',
      categoria: 'Lacteos',
      unidad_medida: 'unidad',
      precio_venta: 16500,
      stock_minimo: 5,
      es_frecuente: true,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'prd-aceite-gourmet',
      tienda_id: tiendaId,
      nombre: 'Aceite Gourmet 1L',
      codigo_barras: '7702001004',
      categoria: 'Abarrotes',
      unidad_medida: 'unidad',
      precio_venta: 11800,
      stock_minimo: 6,
      es_frecuente: true,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'prd-pony-malta',
      tienda_id: tiendaId,
      nombre: 'Pony Malta Personal 330ml',
      codigo_barras: '7702001005',
      categoria: 'Bebidas',
      unidad_medida: 'unidad',
      precio_venta: 2500,
      stock_minimo: 12,
      es_frecuente: true,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'prd-cafe-sello-rojo',
      tienda_id: tiendaId,
      nombre: 'Café Sello Rojo 250g',
      codigo_barras: '7702001006',
      categoria: 'Abarrotes',
      unidad_medida: 'unidad',
      precio_venta: 9200,
      stock_minimo: 6,
      es_frecuente: true,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'prd-queso-campesino',
      tienda_id: tiendaId,
      nombre: 'Queso Campesino Fresco (Granel)',
      codigo_barras: '7702001007',
      categoria: 'Lacteos',
      unidad_medida: 'kg',
      precio_venta: 18000,
      stock_minimo: 2,
      es_frecuente: true,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'prd-chocolate-corona',
      tienda_id: tiendaId,
      nombre: 'Chocolate Corona 500g',
      codigo_barras: '7702001008',
      categoria: 'Abarrotes',
      unidad_medida: 'unidad',
      precio_venta: 8900,
      stock_minimo: 5,
      es_frecuente: false,
      foto_url: null,
      is_active: true,
      created_at: nowISO,
      updated_at: nowISO,
    },
  ]

  // Lotes con distintas fechas de entrada, costos y vencimientos para probar FIFO de inmediato
  const lotesDemo = [
    // Arroz Diana: 2 lotes activos con costos distintos (para ver cómo el primero se agota primero)
    {
      id: 'lot-arroz-01',
      tienda_id: tiendaId,
      producto_id: 'prd-arroz-diana',
      codigo_lote: 'L-ARR-01',
      fecha_entrada: hace10Dias,
      fecha_vencimiento: en45Dias,
      costo_unitario: 2050,
      cantidad_inicial: 20,
      cantidad_disponible: 5,
      notas: 'Compra anterior distribuidora',
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'lot-arroz-02',
      tienda_id: tiendaId,
      producto_id: 'prd-arroz-diana',
      codigo_lote: 'L-ARR-02',
      fecha_entrada: hace2Dias,
      fecha_vencimiento: en120Dias,
      costo_unitario: 2150,
      cantidad_inicial: 30,
      cantidad_disponible: 30,
      notas: 'Remesa nueva',
      created_at: nowISO,
      updated_at: nowISO,
    },
    // Leche Alquería: 1 lote vencido (bloqueado automáticamente), 1 próximo a vencer y 1 nuevo
    {
      id: 'lot-leche-vencido',
      tienda_id: tiendaId,
      producto_id: 'prd-leche-alqueria',
      codigo_lote: 'L-LEC-VENC',
      fecha_entrada: hace10Dias,
      fecha_vencimiento: vencidoAyer,
      costo_unitario: 3500,
      cantidad_inicial: 4,
      cantidad_disponible: 2,
      notas: 'Lote vencido bloqueado para venta',
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'lot-leche-01',
      tienda_id: tiendaId,
      producto_id: 'prd-leche-alqueria',
      codigo_lote: 'L-LEC-01',
      fecha_entrada: hace4Dias,
      fecha_vencimiento: en5Dias,
      costo_unitario: 3600,
      cantidad_inicial: 12,
      cantidad_disponible: 8,
      notas: 'Sale primero por FIFO/FEFO',
      created_at: nowISO,
      updated_at: nowISO,
    },
    {
      id: 'lot-leche-02',
      tienda_id: tiendaId,
      producto_id: 'prd-leche-alqueria',
      codigo_lote: 'L-LEC-02',
      fecha_entrada: hoy,
      fecha_vencimiento: en15Dias,
      costo_unitario: 3700,
      cantidad_inicial: 15,
      cantidad_disponible: 15,
      notas: 'Llegó hoy en la mañana',
      created_at: nowISO,
      updated_at: nowISO,
    },
    // Huevos AA
    {
      id: 'lot-huevos-01',
      tienda_id: tiendaId,
      producto_id: 'prd-huevos-aa',
      codigo_lote: 'L-HUE-01',
      fecha_entrada: hace4Dias,
      fecha_vencimiento: en15Dias,
      costo_unitario: 13500,
      cantidad_inicial: 14,
      cantidad_disponible: 14,
      notas: 'Avícola El Triunfo',
      created_at: nowISO,
      updated_at: nowISO,
    },
    // Aceite Gourmet (Stock bajo)
    {
      id: 'lot-aceite-01',
      tienda_id: tiendaId,
      producto_id: 'prd-aceite-gourmet',
      codigo_lote: 'L-ACE-01',
      fecha_entrada: hace10Dias,
      fecha_vencimiento: en120Dias,
      costo_unitario: 9200,
      cantidad_inicial: 10,
      cantidad_disponible: 3,
      notas: 'Pocas unidades',
      created_at: nowISO,
      updated_at: nowISO,
    },
    // Pony Malta
    {
      id: 'lot-pony-01',
      tienda_id: tiendaId,
      producto_id: 'prd-pony-malta',
      codigo_lote: 'L-PON-01',
      fecha_entrada: hace4Dias,
      fecha_vencimiento: en45Dias,
      costo_unitario: 1750,
      cantidad_inicial: 24,
      cantidad_disponible: 24,
      notas: 'Canasta Bavaria',
      created_at: nowISO,
      updated_at: nowISO,
    },
    // Café Sello Rojo
    {
      id: 'lot-cafe-01',
      tienda_id: tiendaId,
      producto_id: 'prd-cafe-sello-rojo',
      codigo_lote: 'L-CAF-01',
      fecha_entrada: hace10Dias,
      fecha_vencimiento: en120Dias,
      costo_unitario: 7100,
      cantidad_inicial: 16,
      cantidad_disponible: 16,
      notas: 'Nutresa',
      created_at: nowISO,
      updated_at: nowISO,
    },
    // Queso Campesino (Granel en kg)
    {
      id: 'lot-queso-01',
      tienda_id: tiendaId,
      producto_id: 'prd-queso-campesino',
      codigo_lote: 'L-QUE-01',
      fecha_entrada: hace2Dias,
      fecha_vencimiento: en5Dias,
      costo_unitario: 13800,
      cantidad_inicial: 5.5,
      cantidad_disponible: 4.25,
      notas: 'Bloque fresco para venta por peso',
      created_at: nowISO,
      updated_at: nowISO,
    },
  ]

  const ops = []
  for (const p of productosDemo) ops.push({ store: STORES.PRODUCTOS, record: p })
  for (const l of lotesDemo) ops.push({ store: STORES.LOTES, record: l })

  await putManyInStores(ops)
  return {
    productos: productosDemo.length,
    lotes: lotesDemo.length,
    rol_defecto: ROLES.TENDERO,
  }
}
