/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from './SessionContext.jsx'

const WishlistContext = createContext(null)
const WISHLIST_STORAGE_PREFIX = 'xeta:wishlist:v1:'

function getStorageKey(profile) {
  if (!profile) {
    return null
  }

  const identity = profile.clerk_id || profile.id

  if (!identity) {
    return null
  }

  return `${WISHLIST_STORAGE_PREFIX}${identity}`
}

function normalizeVariant(variant) {
  if (!variant || typeof variant !== 'object') {
    return null
  }

  return {
    id: variant.id,
    name: variant.name,
    price: variant.price,
    stock_quantity: variant.stock_quantity,
    image_url: variant.image_url,
    attributes: variant.attributes && typeof variant.attributes === 'object'
      ? variant.attributes
      : {},
  }
}

function normalizeCategory(category) {
  if (!category || typeof category !== 'object') {
    return null
  }

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
  }
}

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return []
  }

  return images
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

function normalizeProduct(product) {
  if (!product || typeof product !== 'object') {
    return null
  }

  const slug = typeof product.slug === 'string' ? product.slug.trim() : ''

  if (!slug) {
    return null
  }

  const normalizedVariants = Array.isArray(product.variants)
    ? product.variants
      .map(normalizeVariant)
      .filter(Boolean)
    : []

  return {
    id: product.id,
    slug,
    name: product.name,
    description: product.description,
    category: normalizeCategory(product.category),
    lowest_price: product.lowest_price,
    average_rating: product.average_rating,
    review_count: product.review_count,
    primary_image: product.primary_image,
    image_url: product.image_url,
    images: normalizeImages(product.images),
    variants: normalizedVariants,
  }
}

function readWishlist(storageKey) {
  if (!storageKey) {
    return []
  }

  try {
    const raw = localStorage.getItem(storageKey)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((entry, index) => {
        const maybeProduct = entry?.product ?? entry
        const product = normalizeProduct(maybeProduct)

        if (!product) {
          return null
        }

        const savedAt = typeof entry?.savedAt === 'string' && entry.savedAt.trim() !== ''
          ? entry.savedAt
          : new Date(Date.now() - index).toISOString()

        return {
          savedAt,
          product,
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
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
  const { profile, isSignedIn, loading } = useSession()
  const canUseWishlist = isSignedIn && !loading && profile?.role !== 'admin'
  const storageKey = useMemo(() => {
    if (!canUseWishlist) {
      return null
    }

    return getStorageKey(profile)
  }, [canUseWishlist, profile])

  const [entriesByKey, setEntriesByKey] = useState({})

  const entries = useMemo(() => {
    if (!storageKey) {
      return []
    }

    if (Object.prototype.hasOwnProperty.call(entriesByKey, storageKey)) {
      return entriesByKey[storageKey]
    }

    return readWishlist(storageKey)
  }, [entriesByKey, storageKey])

  function setCurrentEntries(updater) {
    if (!storageKey) {
      return
    }

    setEntriesByKey((current) => {
      const previousEntries = Object.prototype.hasOwnProperty.call(current, storageKey)
        ? current[storageKey]
        : readWishlist(storageKey)
      const nextEntries = typeof updater === 'function'
        ? updater(previousEntries)
        : updater

      return {
        ...current,
        [storageKey]: nextEntries,
      }
    })
  }

  useEffect(() => {
    if (!storageKey) {
      return
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(entries))
    } catch {
      // Ignore localStorage write failures.
    }
  }, [entries, storageKey])

  const items = useMemo(() => {
    if (!canUseWishlist) {
      return []
    }

    return entries.map((entry) => ({
      ...entry.product,
      wishlist_saved_at: entry.savedAt,
    }))
  }, [canUseWishlist, entries])

  const value = {
    items,
    count: items.length,
    canUseWishlist,
    isWishlisted: (input) => {
      const slug = resolveSlug(input)

      if (!slug) {
        return false
      }

      return entries.some((entry) => entry.product.slug === slug)
    },
    addItem: (product) => {
      if (!canUseWishlist) {
        return { ok: false, reason: 'auth', saved: false }
      }

      const normalizedProduct = normalizeProduct(product)

      if (!normalizedProduct) {
        return { ok: false, reason: 'invalid', saved: false }
      }

      const exists = entries.some((entry) => entry.product.slug === normalizedProduct.slug)

      if (exists) {
        return { ok: true, reason: null, saved: true }
      }

      setCurrentEntries((current) => [{
        savedAt: new Date().toISOString(),
        product: normalizedProduct,
      }, ...current])

      return { ok: true, reason: null, saved: true }
    },
    removeItem: (input) => {
      if (!canUseWishlist) {
        return { ok: false, reason: 'auth' }
      }

      const slug = resolveSlug(input)

      if (!slug) {
        return { ok: false, reason: 'invalid' }
      }

      setCurrentEntries((current) => current.filter((entry) => entry.product.slug !== slug))

      return { ok: true, reason: null }
    },
    toggleItem: (product) => {
      if (!canUseWishlist) {
        return { ok: false, reason: 'auth', saved: false }
      }

      const normalizedProduct = normalizeProduct(product)

      if (!normalizedProduct) {
        return { ok: false, reason: 'invalid', saved: false }
      }

      const exists = entries.some((entry) => entry.product.slug === normalizedProduct.slug)

      if (exists) {
        setCurrentEntries((current) => current.filter((entry) => entry.product.slug !== normalizedProduct.slug))
        return { ok: true, reason: null, saved: false }
      }

      setCurrentEntries((current) => [{
        savedAt: new Date().toISOString(),
        product: normalizedProduct,
      }, ...current])

      return { ok: true, reason: null, saved: true }
    },
    clearWishlist: () => {
      if (!canUseWishlist) {
        return { ok: false, reason: 'auth' }
      }

      setCurrentEntries([])
      return { ok: true, reason: null }
    },
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
