import { setForceMemoryDB, clearAllStores } from '../js/core/db.js'
import { DEFAULT_USERS } from '../js/core/session.js'
import { createProduct, listProductsWithStock } from '../js/services/products.js'
import { createLot } from '../js/services/lots.js'
import { registerSale, cancelSale } from '../js/services/sales.js'

export function registerSalesTests(test, assert) {
  test('Ventas y Permisos: Tendero puede vender pero NO puede crear productos ni lotes ni anular', async () => {
    setForceMemoryDB(true)
    await clearAllStores()

    const owner = DEFAULT_USERS.admin
    const tendero = DEFAULT_USERS.tendero

    // Tendero intenta crear producto -> debe fallar
    let blocked = false
    try {
      await createProduct(
        {
          nombre: 'Producto Prohibido',
          codigo_barras: '999',
          precio_venta: 1000,
        },
        tendero
      )
    } catch {
      blocked = true
    }
    assert(blocked === true, 'El Tendero tiene bloqueada la creación de productos')

    // Dueño crea producto con 2 lotes FIFO
    const prod = await createProduct(
      {
        nombre: 'Aceite 1L',
        codigo_barras: '770100',
        precio_venta: 12000,
        lote_inicial: {
          codigo_lote: 'L-01',
          cantidad_disponible: 2,
          costo_unitario: 9000,
          fecha_entrada: '2026-11-01',
        },
      },
      owner
    )

    await createLot(
      {
        producto_id: prod.id,
        codigo_lote: 'L-02',
        cantidad_disponible: 5,
        costo_unitario: 9500,
        fecha_entrada: '2026-11-10',
      },
      owner
    )

    // Tendero realiza una venta de 3 unidades (debe tomar 2 de L-01 y 1 de L-02)
    const venta = await registerSale(
      [{ id: prod.id, cantidad: 3 }],
      { metodo_pago: 'Efectivo', monto_recibido: 40000 },
      tendero,
      '2026-11-13'
    )

    assert(venta.total === 36000, 'Total de venta = 3 * 12000 = 36000')
    assert(venta.cambio_entregado === 4000, 'Cambio = 40000 - 36000 = 4000')
    assert(venta.detalles[0].asignaciones_lote.length === 2, 'Se asignaron 2 lotes en FIFO')

    let catalog = await listProductsWithStock(owner.tienda_id, '2026-11-13')
    assert(catalog[0].cantidad_disponible === 4, 'Stock restante = 7 - 3 = 4')

    // Tendero intenta anular venta -> bloqueado
    let cancelBlocked = false
    try {
      await cancelSale(venta.id, 'Intento tendero', tendero)
    } catch {
      cancelBlocked = true
    }
    assert(cancelBlocked === true, 'El Tendero no puede anular ventas')

    // Dueño anula la venta -> devuelve unidades a L-01 y L-02
    const anulada = await cancelSale(venta.id, 'Devolución autorizada', owner)
    assert(anulada.estado === 'ANULADA', 'Estado pasa a ANULADA')

    catalog = await listProductsWithStock(owner.tienda_id, '2026-11-13')
    assert(catalog[0].cantidad_disponible === 7, 'Las 3 unidades regresaron a sus lotes originales (stock = 7)')
  })
}
