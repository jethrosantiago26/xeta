/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { addWishlistItem, getWishlist, removeWishlistItem } from '../lib/api.js'
import { useSession } from './SessionContext.jsx'

const WishlistContext = createContext(null)
const REFRESH_INTERVAL_MS = 10000

function unwrapResource(resource) {
  if (!resource || typeof resource !== 'object') {
    return resource
  }

  if (resource.data && typeof resource.data === 'object') {
    return resource.data
  }

  return resource
}

function normalizeVariant(variant) {
  if (!variant || typeof variant !== 'object') {
    return null
  }

  const variantId = Number(variant.id)

  return {
    id: Number.isFinite(variantId) ? variantId : variant.id,
    name: variant.name,
    price: variant.price,
    sale_price: variant.sale_price,
    final_price: variant.final_price,
    sale_discount_amount: variant.sale_discount_amount,
    sale_discount_percentage: variant.sale_discount_percentage,
    sale_label: variant.sale_label,
    sale_starts_at: variant.sale_starts_at,
    sale_ends_at: variant.sale_ends_at,
    on_sale: Boolean(variant.on_sale),
    compare_at_price: variant.compare_at_price,
    stock_quantity: Number(variant.stock_quantity ?? 0),
    image_url: variant.image_url,
    attributes: variant.attributes && typeof variant.attributes === 'object'
      ? variant.attributes
      : {},
  }
}

function normalizeCategory(category) {
  const normalized = unwrapResource(category)

  if (!normalized || typeof normalized !== 'object') {
    return null
  }

  return {
    id: normalized.id,
    name: normalized.name,
    slug: normalized.slug,
  }
}

function normalizeImages(images) {
  const imageList = unwrapResource(images)

  if (!Array.isArray(imageList)) {
    return []
  }

  return imageList
    .map((image) => {
      if (typeof image === 'string') {
        return { url: image }
      }

      if (!image || typeof image !== 'object') {
        return null
      }

      return { url: image.url }
    })
    .filter((image) => image && typeof image.url === 'string' && image.url.trim() !== '')
}

function normalizeVariants(variants) {
  const variantList = unwrapResource(variants)

  if (!Array.isArray(variantList)) {
    return []
  }

  return variantList
    .map(normalizeVariant)
    .filter(Boolean)
}

function normalizeProduct(product) {
  const normalized = unwrapResource(product)

  if (!normalized || typeof normalized !== 'object') {
    return null
  }

  const slug = typeof normalized.slug === 'string' ? normalized.slug.trim() : ''

  if (!slug) {
    return null
  }

  const normalizedVariants = normalizeVariants(normalized.variants)
  const normalizedImages = normalizeImages(normalized.images)
  const primaryImage = normalized.primary_image || normalized.image_url || normalized.image
  const reviewCount = Number(normalized.review_count ?? 0)
  const averageRating = Number(normalized.average_rating ?? 0)

  return {
    id: normalized.id,
    slug,
    name: normalized.name,
    description: normalized.description,
    category: normalizeCategory(normalized.category),
    lowest_price: normalized.lowest_price,
    lowest_sale_price: normalized.lowest_sale_price,
    lowest_original_price: normalized.lowest_original_price,
    sale: normalized.sale && typeof normalized.sale === 'object' ? normalized.sale : null,
    average_rating: Number.isFinite(averageRating) ? averageRating : 0,
    review_count: Number.isFinite(reviewCount) ? reviewCount : 0,
    primary_image: primaryImage,
    image_url: primaryImage,
    images: normalizedImages,
    variants: normalizedVariants,
  }
}

function normalizeWishlistEntries(payload) {
  const itemList = payload?.items?.data ?? payload?.items ?? []

  if (!Array.isArray(itemList)) {
    return []
  }

  const seenBySlug = new Set()

  return itemList
    .map((item, index) => {
      const product = normalizeProduct(item?.product)

      if (!product || seenBySlug.has(product.slug)) {
        return null
      }

      seenBySlug.add(product.slug)

      const entryId = Number(item?.id)
      const variantId = Number(item?.variant_id)
      const savedAt = typeof item?.added_at === 'string' && item.added_at.trim() !== ''
        ? item.added_at
        : new Date(Date.now() - index).toISOString()

      return {
        id: Number.isFinite(entryId) ? entryId : null,
        variantId: Number.isFinite(variantId) ? variantId : null,
        savedAt,
        product,
      }
    })
    .filter(Boolean)
}

function resolveVariantId(product, preferredVariantId = null) {
  const candidateId = Number(preferredVariantId)

  if (Number.isFinite(candidateId) && product.variants.some((variant) => Number(variant.id) === candidateId)) {
    return candidateId
  }

  const firstVariantId = Number(product.variants[0]?.id)

  if (Number.isFinite(firstVariantId)) {
    return firstVariantId
  }

  return null
}

function resolveSlug(input) {
  if (typeof input === 'string') {
    return input.trim()
  }

  if (input && typeof input === 'object' && typeof input.slug === 'string') {
    return input.slug.trim()
  }

  return ''
}

export function WishlistProvider({ children }) {
  const { profile, isLoaded, isSignedIn, loading } = useSession()
  const canUseWishlist = isSignedIn && !loading && profile?.role !== 'admin'
  const [entries, setEntries] = useState([])
  const [wishlistLoading, setWishlistLoading] = useState(false)

  const refreshWishlist = useCallback(async ({ background = false } = {}) => {
    if (!canUseWishlist) {
      setEntries([])
      setWishlistLoading(false)
      return
    }

    if (!background) {
      setWishlistLoading(true)
    }

    try {
      const response = await getWishlist()
      setEntries(normalizeWishlistEntries(response.data))
    } catch {
      if (!background) {
        setEntries([])
      }
    } finally {
      if (!background) {
        setWishlistLoading(false)
      }
    }
  }, [canUseWishlist])

  useEffect(() => {
    if (!isLoaded || loading) {
      return
    }

    refreshWishlist()
  }, [isLoaded, loading, refreshWishlist])

  useEffect(() => {
    if (!isLoaded || loading || !canUseWishlist) {
      return
    }

    function refreshVisibleWishlist() {
      if (document.hidden) {
        return
      }

      refreshWishlist({ background: true })
    }

    const intervalId = window.setInterval(refreshVisibleWishlist, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshVisibleWishlist)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVisibleWishlist)
    }
  }, [canUseWishlist, isLoaded, loading, refreshWishlist])

  const items = useMemo(() => {
    if (!canUseWishlist) {
      return []
    }

    return entries.map((entry) => ({
      ...entry.product,
      wishlist_saved_at: entry.savedAt,
    }))
  }, [canUseWishlist, entries])

  const addItem = useCallback(async (product, preferredVariantId = null) => {
    if (!canUseWishlist) {
      return { ok: false, reason: 'auth', saved: false }
    }

    const normalizedProduct = normalizeProduct(product)

    if (!normalizedProduct) {
      return { ok: false, reason: 'invalid', saved: false }
    }

    if (entries.some((entry) => entry.product.slug === normalizedProduct.slug)) {
      return { ok: true, reason: null, saved: true }
    }

    const variantId = resolveVariantId(normalizedProduct, preferredVariantId)

    if (!variantId) {
      return { ok: false, reason: 'invalid', saved: false }
    }

    try {
      const response = await addWishlistItem({ variant_id: variantId })
      const itemId = Number(response?.data?.item_id)

      setEntries((current) => [{
        id: Number.isFinite(itemId) ? itemId : null,
        variantId,
        savedAt: new Date().toISOString(),
        product: normalizedProduct,
      }, ...current.filter((entry) => entry.product.slug !== normalizedProduct.slug)])

      // Pull canonical product details after optimistic local add.
      refreshWishlist({ background: true })

      return { ok: true, reason: null, saved: true }
    } catch (error) {
      if (error?.response?.status === 409) {
        refreshWishlist({ background: true })
        return { ok: true, reason: null, saved: true }
      }

      return { ok: false, reason: 'request', saved: false }
    }
  }, [canUseWishlist, entries, refreshWishlist])

  const removeItem = useCallback(async (input) => {
    if (!canUseWishlist) {
      return { ok: false, reason: 'auth' }
    }

    const slug = resolveSlug(input)

    if (!slug) {
      return { ok: false, reason: 'invalid' }
    }

    const existingEntry = entries.find((entry) => entry.product.slug === slug)

    if (!existingEntry) {
      return { ok: true, reason: null }
    }

    if (!existingEntry.id) {
      setEntries((current) => current.filter((entry) => entry.product.slug !== slug))
      return { ok: true, reason: null }
    }

    try {
      await removeWishlistItem(existingEntry.id)
      setEntries((current) => current.filter((entry) => entry.product.slug !== slug))
      refreshWishlist({ background: true })
      return { ok: true, reason: null }
    } catch {
      return { ok: false, reason: 'request' }
    }
  }, [canUseWishlist, entries, refreshWishlist])

  const toggleItem = useCallback(async (product, preferredVariantId = null) => {
    if (!canUseWishlist) {
      return { ok: false, reason: 'auth', saved: false }
    }

    const normalizedProduct = normalizeProduct(product)

    if (!normalizedProduct) {
      return { ok: false, reason: 'invalid', saved: false }
    }

    const exists = entries.some((entry) => entry.product.slug === normalizedProduct.slug)

    if (exists) {
      const result = await removeItem(normalizedProduct.slug)
      return {
        ok: result.ok,
        reason: result.reason,
        saved: false,
      }
    }

    return addItem(normalizedProduct, preferredVariantId)
  }, [addItem, canUseWishlist, entries, removeItem])

  const clearWishlist = useCallback(async () => {
    if (!canUseWishlist) {
      return { ok: false, reason: 'auth' }
    }

    const entriesWithIds = entries.filter((entry) => entry.id)

    if (entriesWithIds.length === 0) {
      setEntries([])
      return { ok: true, reason: null }
    }

    try {
      await Promise.all(entriesWithIds.map((entry) => removeWishlistItem(entry.id)))
      setEntries([])
      refreshWishlist({ background: true })
      return { ok: true, reason: null }
    } catch {
      await refreshWishlist()
      return { ok: false, reason: 'request' }
    }
  }, [canUseWishlist, entries, refreshWishlist])

  const value = {
    items,
    count: items.length,
    loading: wishlistLoading,
    canUseWishlist,
    isWishlisted: (input) => {
      const slug = resolveSlug(input)

      if (!slug) {
        return false
      }

      return entries.some((entry) => entry.product.slug === slug)
    },
    addItem,
    removeItem,
    toggleItem,
    clearWishlist,
    refreshWishlist,
  }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const context = useContext(WishlistContext)

  if (!context) {
    throw new Error('useWishlist must be used inside WishlistProvider')
  }

  return context
}
