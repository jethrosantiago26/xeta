import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { addCartItem, getCart, removeCartItem, updateCartItem } from '../lib/api.js'
import { useSession } from './SessionContext.jsx'

const CartContext = createContext(null)
const REFRESH_INTERVAL_MS = 10000

function normalizeCart(payload) {
  if (!payload) {
    return { items: [], totals: { subtotal: 0, tax: 0, shipping: 0, total: 0 } }
  }

  const items = payload.items?.data ?? payload.items ?? []
  const totals = payload.totals ?? { subtotal: 0, tax: 0, shipping: 0, total: 0 }

  return { items, totals }
}

export function CartProvider({ children }) {
  const { profile, isLoaded } = useSession()
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState({ subtotal: 0, tax: 0, shipping: 0, total: 0 })
  const [loading, setLoading] = useState(false)

  const refreshCart = useCallback(async ({ background = false } = {}) => {
    if (!profile) {
      setItems([])
      setTotals({ subtotal: 0, tax: 0, shipping: 0, total: 0 })
      return
    }

    if (!background) {
      setLoading(true)
    }

    try {
      const response = await getCart()
      const cart = normalizeCart(response.data)
      setItems(cart.items)
      setTotals(cart.totals)
    } catch (error) {
      if (!background) {
        setItems([])
        setTotals({ subtotal: 0, tax: 0, shipping: 0, total: 0 })
      }
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, [profile])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    refreshCart()
  }, [isLoaded, refreshCart])

  useEffect(() => {
    if (!isLoaded || !profile) {
      return
    }

    function refreshVisibleCart() {
      if (document.hidden) {
        return
      }

      refreshCart({ background: true })
    }

    const intervalId = window.setInterval(refreshVisibleCart, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshVisibleCart)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVisibleCart)
    }
  }, [isLoaded, profile, refreshCart])

  const value = {
    items,
    totals,
    loading,
    refreshCart,
    addItem: async (variantId, quantity = 1) => {
      await addCartItem({ variant_id: variantId, quantity })
      await refreshCart()
    },
    updateItem: async (cartItemId, quantity) => {
      await updateCartItem(cartItemId, { quantity })
      await refreshCart()
    },
    removeItem: async (cartItemId) => {
      await removeCartItem(cartItemId)
      await refreshCart()
    },
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }

  return context
}