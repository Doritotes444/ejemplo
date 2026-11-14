import {
  addItemToCartList,
  decrementItemInCartList,
  setItemQuantityInCartList,
  removeItemFromCartList,
  calculateCartTotal,
} from '../js/state.js'
import { getCartStorageKey, DEFAULT_USERS } from '../js/core/session.js'

export function registerCartTests(test, assert) {
  test('Carrito: agrega productos, respeta el límite de stock y calcula el total', () => {
    const prod = {
      id: 'prd-1',
      nombre: 'Arroz 500g',
      precio_venta: 2800,
      unidad_medida: 'unidad',
      cantidad_disponible: 2,
    }

    let res = addItemToCartList([], prod, 1)
    assert(res.added === true, 'Debe permitir agregar la primera unidad')
    assert(res.cart[0].cantidad === 1, 'Cantidad inicial debe ser 1')

    res = addItemToCartList(res.cart, prod, 1)
    assert(res.added === true, 'Debe permitir agregar la segunda unidad')
    assert(res.cart[0].cantidad === 2, 'Cantidad debe ser 2')

    res = addItemToCartList(res.cart, prod, 1)
    assert(res.added === false, 'No debe exceder el stock disponible (2)')
    assert(res.cart[0].cantidad === 2, 'La cantidad permanece en el tope disponible')
    assert(calculateCartTotal(res.cart) === 5600, 'El total debe ser 5600')
  })

  test('Carrito: soporta cantidades fraccionarias (granel en kg) y redondeo a 3 decimales', () => {
    const queso = {
      id: 'prd-queso',
      nombre: 'Queso Campesino',
      precio_venta: 18000,
      unidad_medida: 'kg',
      cantidad_disponible: 3.5,
    }

    let res = addItemToCartList([], queso, 0.375)
    assert(res.added === true, 'Permite agregar 0.375 kg')
    assert(res.cart[0].cantidad === 0.375, 'Conserva los 3 decimales')
    assert(calculateCartTotal(res.cart) === 6750, 'Total 18000 * 0.375 = 6750')

    const updated = setItemQuantityInCartList(res.cart, 'prd-queso', 1.25)
    assert(updated[0].cantidad === 1.25, 'Actualiza cantidad fraccionaria a 1.25 kg')
    assert(calculateCartTotal(updated) === 22500, 'Total 18000 * 1.25 = 22500')

    const clamped = setItemQuantityInCartList(updated, 'prd-queso', 9.9)
    assert(clamped[0].cantidad === 3.5, 'Limita al stock disponible (3.5 kg)')
  })

  test('Carrito: restar, eliminar y separar clave de almacenamiento por tienda y usuario', () => {
    const prod = {
      id: 'prd-2',
      nombre: 'Pony Malta',
      precio_venta: 2500,
      unidad_medida: 'unidad',
      cantidad_disponible: 5,
    }
    const { cart } = addItemToCartList([], prod, 2)
    const afterDec = decrementItemInCartList(cart, 'prd-2', 1)
    assert(afterDec[0].cantidad === 1, 'Resta 1 unidad')

    const afterRemove = removeItemFromCartList(afterDec, 'prd-2')
    assert(afterRemove.length === 0, 'Elimina el producto del carrito')

    const keyTendero = getCartStorageKey(DEFAULT_USERS.tendero)
    const keyAdmin = getCartStorageKey(DEFAULT_USERS.admin)
    assert(keyTendero !== keyAdmin, 'Las claves de carrito de Tendero y Dueño están separadas')
  })
}
