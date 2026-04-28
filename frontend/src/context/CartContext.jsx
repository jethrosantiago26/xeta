/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { addCartItem, getCart, removeCartItem, updateCartItem } from '../lib/api.js'
import { useSession } from './SessionContext.jsx'

const CartContext = createContext(null)
const REFRESH_INTERVAL_MS = 10000
const EMPTY_TOTALS = {
  subtotal: 0,
  item_discount: 0,
  order_discount: 0,
  discount_total: 0,
  tax: 0,
  shipping: 0,
  total: 0,
}
const EMPTY_PROMOTIONS = { items: [], order: [] }

function normalizeCart(payload) {
  if (!payload) {
    return {
      items: [],
      totals: EMPTY_TOTALS,
      promotions: EMPTY_PROMOTIONS,
    }
  }

  const items = payload.items?.data ?? payload.items ?? []
  const totals = {
    ...EMPTY_TOTALS,
    ...(payload.totals ?? {}),
  }
  const promotions = {
    ...EMPTY_PROMOTIONS,
    ...(payload.promotions ?? {}),
  }

  return { items, totals, promotions }
}

export function CartProvider({ children }) {
  const { profile, isLoaded, isSignedIn, loading: sessionLoading } = useSession()
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState(EMPTY_TOTALS)
  const [promotions, setPromotions] = useState(EMPTY_PROMOTIONS)
  const [loading, setLoading] = useState(false)

  const refreshCart = useCallback(async ({ background = false } = {}) => {

    if (!isSignedIn || !profile || profile.role === 'admin') {
      setItems([])
      setTotals(EMPTY_TOTALS)
      setPromotions(EMPTY_PROMOTIONS)
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
      setPromotions(cart.promotions)
    } catch {
      if (!background) {
        setItems([])
        setTotals(EMPTY_TOTALS)
        setPromotions(EMPTY_PROMOTIONS)
      }
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, [isSignedIn, profile])

  useEffect(() => {
    if (!isLoaded || sessionLoading) {
      return
    }

    refreshCart()
  }, [isLoaded, sessionLoading, refreshCart])

  useEffect(() => {
    if (!isLoaded || sessionLoading || !isSignedIn || !profile || profile.role === 'admin') {
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
  }, [isLoaded, sessionLoading, isSignedIn, profile, refreshCart])

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
    promotions,
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