import { getAssetUrl } from './api.js'

const ORDER_ITEM_FALLBACK_IMAGE = '/vite.svg'

function normalizeAssetCandidate(value) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().replace(/\\/g, '/').replace(/^\.\//, '')

  return normalized || null
}

function resolveAssetCandidate(value) {
  const normalized = normalizeAssetCandidate(value)

  if (!normalized) {
    return null
  }

  if (
    normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('data:')
    || normalized.startsWith('blob:')
    || normalized.startsWith('//')
  ) {
    return normalized
  }

  return getAssetUrl(normalized)
}

export function normalizeOrderItemText(value) {
  if (value == null) {
    return ''
  }

  return String(value)
    .replace(/\uFFFD+/g, ' - ')
    .replace(/\s*\?{2,}\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function normalizeDisplayText(value) {
  return normalizeOrderItemText(value)
}

function collectProductImageCandidates(product, preferredVariant = null) {
  const variants = Array.isArray(product?.variants)
    ? product.variants
    : []

  const selectedVariantCandidates = preferredVariant
    ? [
      preferredVariant?.image_url,
      preferredVariant?.attributes?.image_url,
      preferredVariant?.attributes?.image,
      preferredVariant?.attributes?.preview_image,
    ]
    : []

  const selectedVariantVisualFallback = preferredVariant?.visual?.image || null

  const variantCandidates = variants.flatMap((variant) => [
    variant?.image_url,
    variant?.attributes?.image_url,
    variant?.attributes?.image,
    variant?.attributes?.preview_image,
    variant?.visual?.image,
  ])

  const productGallery = Array.isArray(product?.images)
    ? product.images.map((entry) => entry?.url)
    : []

  const dedupeList = [
    ...selectedVariantCandidates,
    ...variantCandidates,
    product?.primary_image,
    product?.image_url,
    product?.image,
    ...productGallery,
    selectedVariantVisualFallback,
  ]

  return Array.from(new Set(dedupeList.filter(Boolean)))
}

export function resolveProductImage(product, options = {}) {
  const {
    variant = null,
    fallbackImage = ORDER_ITEM_FALLBACK_IMAGE,
  } = options

  const imageCandidates = collectProductImageCandidates(product, variant)

  for (const candidate of imageCandidates) {
    const resolved = resolveAssetCandidate(candidate)

    if (resolved) {
      return resolved
    }
  }

  return fallbackImage
}

export function resolveOrderItemImage(item, fallbackImage = ORDER_ITEM_FALLBACK_IMAGE) {
  const productGallery = Array.isArray(item?.product?.images)
    ? item.product.images.map((entry) => entry?.url)
    : []

  const variantCandidates = [
    item?.variant?.image_url,
    item?.variant?.attributes?.image_url,
    item?.variant?.attributes?.image,
    item?.variant?.attributes?.preview_image,
  ]

  const variantAssetCandidates = variantCandidates.filter(
    (candidate) => typeof candidate === 'string' && candidate.trim() !== '' && !candidate.trim().startsWith('data:'),
  )

  const variantDataCandidates = variantCandidates.filter(
    (candidate) => typeof candidate === 'string' && candidate.trim().startsWith('data:'),
  )

  const imageCandidates = [
    ...variantAssetCandidates,
    item?.product?.primary_image,
    item?.product?.image_url,
    ...productGallery,
    ...variantDataCandidates,
  ]

  for (const candidate of imageCandidates) {
    const resolved = resolveAssetCandidate(candidate)

    if (resolved) {
      return resolved
    }
  }

  return fallbackImage
}
