import { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext(null)

const CART_STORAGE_KEY = 'pos_carrito'

function getSavedCart() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [carrito, setCarrito] = useState(getSavedCart)
  const [carritoAbierto, setCarritoAbierto] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carrito))
    } catch {
      // ignorar errores de almacenamiento
    }
  }, [carrito])

  const agregar = (producto, abrir = false) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === producto.id)
      if (existe) {
        if (existe.cantidad >= producto.cantidad_actual) return prev
        return prev.map(i =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      // Para granel con stock < 1 arrancamos en el stock disponible
      const cantidad_inicial = Math.min(1, producto.cantidad_actual)
      if (cantidad_inicial <= 0) return prev
      return [...prev, { ...producto, cantidad: cantidad_inicial }]
    })
    if (abrir) {
      setCarritoAbierto(true)
    }
  }

  const restar = (productoId) => {
    setCarrito(prev =>
      prev
        .map(i => (i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter(i => i.cantidad > 0)
    )
  }

  // Permite escribir una cantidad arbitraria (granel). Valida contra el stock.
  const setCantidad = (productoId, nuevaCantidad) => {
    setCarrito(prev => {
      const item = prev.find(i => i.id === productoId)
      if (!item) return prev
      const cantidad = Math.min(
        Math.max(parseFloat(nuevaCantidad) || 0, 0),
        item.cantidad_actual,
      )
      if (cantidad <= 0) return prev.filter(i => i.id !== productoId)
      return prev.map(i => i.id === productoId ? { ...i, cantidad } : i)
    })
  }

  const eliminar = (productoId) => {
    setCarrito(prev => prev.filter(i => i.id !== productoId))
  }

  const vaciar = () => setCarrito([])

  const total = carrito.reduce((acc, i) => acc + i.precio_venta * i.cantidad, 0)

  return (
    <CartContext.Provider
      value={{ carrito, carritoAbierto, setCarritoAbierto, agregar, restar, setCantidad, eliminar, vaciar, total }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart fuera de CartProvider')
  return ctx
}
