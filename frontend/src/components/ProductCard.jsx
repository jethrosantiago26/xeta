import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { getAssetUrl } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { getVariantVisual } from '../lib/variantVisuals.js'

function ProductCard({
  product,
  prioritizeImage = false,
  imageFetchPriority = 'auto',
  layout = 'card',
  showDescription = true,
  uniformCardDesign = false,
}) {
  const navigate = useNavigate()
  const { addItem } = useCart()

  const visualVariants = useMemo(() => {
    const sortedVariants = [...(product.variants ?? [])].sort((left, right) => Number(left.price) - Number(right.price))

    return sortedVariants.map((variant, index) => ({
      ...variant,
      visual: getVariantVisual(variant, {
        index,
        productName: product.name,
      }),
    }))
  }, [product])

  const [selectedVariantId, setSelectedVariantId] = useState(String(visualVariants[0]?.id ?? ''))
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [sheetAction, setSheetAction] = useState('cart')
  const [actionQuantity, setActionQuantity] = useState(1)

  const selectedVariant = useMemo(() => {
    return visualVariants.find((variant) => String(variant.id) === selectedVariantId)
      ?? visualVariants[0]
      ?? null
  }, [visualVariants, selectedVariantId])

  const variantImageCandidates = visualVariants.flatMap((variant) => [
    variant?.image_url,
    variant?.attributes?.image_url,
    variant?.attributes?.image,
    variant?.attributes?.preview_image,
  ])
  const galleryImageCandidates = Array.isArray(product.images)
    ? product.images.map((imageEntry) => imageEntry?.url)
    : []
  const generatedVariantPreview = selectedVariant?.visual?.image

  const productPath = `/products/${product.slug}`
  const isRowLayout = layout === 'row'
  const imageCandidates = [
    selectedVariant?.image_url,
    selectedVariant?.attributes?.image_url,
    selectedVariant?.attributes?.image,
    selectedVariant?.attributes?.preview_image,
    product.primary_image,
    product.image_url,
    ...galleryImageCandidates,
    ...variantImageCandidates,
    generatedVariantPreview,
  ]
  const imagePath = imageCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim() !== '')
  const normalizedImagePath = imagePath ? imagePath.trim().replace(/\\/g, '/') : ''
  const image = imagePath
    ? normalizedImagePath.startsWith('data:')
      ? normalizedImagePath
      : getAssetUrl(normalizedImagePath)
    : '/vite.svg'
  const price = selectedVariant?.price ?? product.lowest_price ?? product.variants?.[0]?.price ?? 0
  const reviewCount = Number(product.review_count ?? 0)
  const reviewLabel = reviewCount === 1 ? '1 review' : `${reviewCount} reviews`
  const averageRatingValue = Number(product.average_rating)
  const hasAverageRating = Number.isFinite(averageRatingValue) && averageRatingValue > 0
  const averageRatingLabel = hasAverageRating ? averageRatingValue.toFixed(1) : '0.0'
  const hasMultipleVariants = visualVariants.length > 1
  const isSoldOut = !selectedVariant || selectedVariant.stock_quantity <= 0
  const priceLabel = selectedVariant
    ? formatMoney(price)
    : price > 0
      ? `from ${formatMoney(price)}`
      : 'See options'
  const feedbackMessage = actionError || actionMessage

  function handleOpenQuantitySheet(nextAction) {
    if (!selectedVariant || selectedVariant.stock_quantity <= 0) {
      setActionMessage('')
      setActionError('This variant is currently unavailable.')
      return
    }

    setActionMessage('')
    setActionError('')
    setSheetAction(nextAction)
    setActionQuantity(1)
    setShowActionSheet(true)
  }

  async function handleSheetConfirm() {
    if (!selectedVariant || selectedVariant.stock_quantity <= 0) {
      setShowActionSheet(false)
      setActionMessage('')
      setActionError('This variant is currently unavailable.')
      return
    }

    const safeQuantity = Math.max(1, Math.min(actionQuantity, selectedVariant.stock_quantity))

    setBusyAction(sheetAction)
    setActionMessage('')
    setActionError('')

    try {
      await addItem(selectedVariant.id, safeQuantity)

      if (sheetAction === 'buy') {
        setShowActionSheet(false)
        navigate('/checkout')
        return
      }

      setActionMessage(`Added ${safeQuantity} item${safeQuantity > 1 ? 's' : ''} to cart.`)
      setShowActionSheet(false)
    } catch {
      setActionError('Sign in first to continue.')
      setShowActionSheet(false)
    } finally {
      setBusyAction('')
    }
  }

  function isInteractiveCardTarget(target) {
    return target instanceof Element
      && Boolean(target.closest('button, a, input, select, textarea, [role="button"], [role="radio"]'))
  }

  function handleCardNavigate(event) {
    if (isInteractiveCardTarget(event.target)) {
      return
    }

    navigate(productPath)
  }

  function handleCardKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    if (isInteractiveCardTarget(event.target)) {
      return
    }

    event.preventDefault()
    navigate(productPath)
  }

  const actionSheet = selectedVariant && createPortal(
        <div
          className={`cart-bottom-sheet-backdrop ${showActionSheet ? 'open' : ''}`}
          onClick={() => setShowActionSheet(false)}
        >
          <div
            className="cart-bottom-sheet-container"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-bottom-sheet-handle" />

            <div className="cart-bottom-sheet-header">
              <img
                src={image}
                alt={selectedVariant.name}
                className="cart-bottom-sheet-visual"
              />
              <div className="cart-bottom-sheet-details">
                <h3 style={{ margin: 0, fontSize: '18px' }}>{product.name}</h3>
                <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
                  {selectedVariant.name} · {formatMoney(price)}
                </p>
              </div>
            </div>

            <div className="cart-bottom-sheet-qty-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 500 }}>Quantity</span>
                <span className="muted" style={{ fontSize: '13px' }}>
                  {selectedVariant.stock_quantity > 0
                    ? `Current stock: ${selectedVariant.stock_quantity}`
                    : 'Out of stock'}
                </span>
              </div>

              <div className="cart-bottom-sheet-stepper">
                <button
                  disabled={actionQuantity <= 1}
                  onClick={() => setActionQuantity((quantity) => Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <span>{actionQuantity}</span>
                <button
                  disabled={actionQuantity >= selectedVariant.stock_quantity}
                  onClick={() => setActionQuantity((quantity) => Math.min(selectedVariant.stock_quantity, quantity + 1))}
                  aria-label="Increase quantity"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="button"
              className="button button-primary"
              style={{ width: '100%', padding: '16px', fontSize: '16px' }}
              disabled={busyAction !== '' || selectedVariant.stock_quantity === 0}
              onClick={handleSheetConfirm}
            >
              {busyAction === 'buy'
                ? 'Preparing checkout...'
                : busyAction === 'cart'
                  ? 'Adding to cart...'
                  : sheetAction === 'buy'
                    ? `Buy now — ${formatMoney(price * actionQuantity)}`
                    : `Add to cart — ${formatMoney(price * actionQuantity)}`}
            </button>
          </div>
        </div>,
        document.body,
      )

  if (isRowLayout) {
    return (
      <>
        <article
          className="product-card product-card-row product-card-clickable"
          role="link"
          tabIndex={0}
          aria-label={`View ${product.name}`}
          onClick={handleCardNavigate}
          onKeyDown={handleCardKeyDown}
        >
          <div className="product-card-media product-card-row-media">
            <img
              src={image}
              alt={product.name}
              loading={prioritizeImage ? 'eager' : 'lazy'}
              fetchPriority={imageFetchPriority}
              decoding="async"
            />
          </div>

          <div className="product-card-row-content">
            <div className="row product-card-head-row" style={{ justifyContent: 'space-between' }}>
              <p className="meta" style={{ margin: 0 }}>{product.category?.name ?? 'Peripherals'}</p>
              <div className="product-card-rating-wrap">
                {hasAverageRating ? (
                  <span className="status-pill" style={{ fontSize: '10px' }}>
                    ★ {averageRatingLabel}
                  </span>
                ) : null}
                <span className="product-card-review-count">{reviewLabel}</span>
              </div>
            </div>

            <h3 className="product-card-row-title">{product.name}</h3>
            <p className="product-card-row-description">
              {product.description?.slice(0, 200) || 'High quality peripherals for work and play.'}
            </p>

            <div className="row product-card-row-price-row" style={{ justifyContent: 'space-between' }}>
              <strong className="price">{priceLabel}</strong>
              {selectedVariant ? (
                <span className="product-card-row-variant-label">{selectedVariant.name}</span>
              ) : null}
            </div>
          </div>

          <div className="product-card-row-actions">
            {hasMultipleVariants ? (
              <div className="product-card-variant-row">
                <div className="product-card-variant-menu" role="radiogroup" aria-label={`Choose ${product.name} variant preview`}>
                  {visualVariants.map((variant) => {
                    const isActive = String(variant.id) === String(selectedVariant?.id ?? '')

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={`${variant.name} ${formatMoney(variant.price)}`}
                        className={`product-card-meatball${isActive ? ' active' : ''}`}
                        style={{
                          '--variant-color': variant.visual.color,
                          '--variant-ring': variant.visual.ringColor,
                          '--variant-ink': variant.visual.textColor,
                        }}
                        onClick={() => setSelectedVariantId(String(variant.id))}
                      />
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="product-card-row-buttons">
              <button
                type="button"
                className="button button-primary product-card-row-button"
                disabled={isSoldOut || busyAction !== ''}
                onClick={() => handleOpenQuantitySheet('cart')}
              >
                Add to cart
              </button>
              <button
                type="button"
                className="button button-secondary product-card-row-button"
                disabled={isSoldOut || busyAction !== ''}
                onClick={() => handleOpenQuantitySheet('buy')}
              >
                Buy now
              </button>
            </div>

            <p className={`product-card-feedback${actionError ? ' error' : actionMessage ? ' success' : ''}`} role="status" aria-live="polite">
              {feedbackMessage}
            </p>
          </div>
        </article>

        {actionSheet}
      </>
    )
  }

  return (
    <>
      <article
        className={`product-card product-card-clickable${uniformCardDesign ? ' product-card-uniform' : ''}`}
        role="link"
        tabIndex={0}
        aria-label={`View ${product.name}`}
        onClick={handleCardNavigate}
        onKeyDown={handleCardKeyDown}
      >
        <div className="product-card-media">
          <img
            src={image}
            alt={product.name}
            loading={prioritizeImage ? 'eager' : 'lazy'}
            fetchPriority={imageFetchPriority}
            decoding="async"
          />
        </div>
        <div className="stack product-card-body" style={{ marginTop: '14px', gap: '8px' }}>
          <div className="row product-card-head-row" style={{ justifyContent: uniformCardDesign ? 'flex-start' : 'space-between' }}>
            <p className="meta" style={{ margin: 0 }}>{product.category?.name ?? 'Peripherals'}</p>
            {!uniformCardDesign ? (
              <div className="product-card-rating-wrap">
                {hasAverageRating ? (
                  <span className="status-pill" style={{ fontSize: '10px' }}>
                    ★ {averageRatingLabel}
                  </span>
                ) : null}
                <span className="product-card-review-count">{reviewLabel}</span>
              </div>
            ) : null}
          </div>
          {uniformCardDesign ? (
            <div className="product-card-rating-wrap product-card-rating-wrap-uniform">
              <span className={`status-pill${hasAverageRating ? '' : ' status-pill-fallback'}`} style={{ fontSize: '10px' }}>
                ★ {averageRatingLabel}
              </span>
              <span className="product-card-review-count">{reviewLabel}</span>
            </div>
          ) : null}
          <h2 style={{ fontSize: '13px', lineHeight: 1.35 }}>{product.name}</h2>
          {showDescription ? (
            <p className="muted" style={{ fontSize: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {product.description?.slice(0, 100) || 'High quality peripherals for work and play.'}
            </p>
          ) : null}
          <div className="product-card-variant-row">
            {hasMultipleVariants ? (
              <div className="product-card-variant-menu" role="radiogroup" aria-label={`Choose ${product.name} variant preview`}>
                {visualVariants.map((variant) => {
                  const isActive = String(variant.id) === String(selectedVariant?.id ?? '')

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={`${variant.name} ${formatMoney(variant.price)}`}
                      className={`product-card-meatball${isActive ? ' active' : ''}`}
                      style={{
                        '--variant-color': variant.visual.color,
                        '--variant-ring': variant.visual.ringColor,
                        '--variant-ink': variant.visual.textColor,
                      }}
                      onClick={() => setSelectedVariantId(String(variant.id))}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="product-card-variant-placeholder" aria-hidden="true" />
            )}
          </div>
          <div className="row product-card-price-row" style={{ justifyContent: 'space-between' }}>
            <strong className="price">{priceLabel}</strong>
          </div>
          <div className="product-card-actions">
            <button
              type="button"
              className="button button-secondary product-card-action-icon"
              disabled={isSoldOut || busyAction !== ''}
              aria-label={isSoldOut ? 'Sold out' : 'Add to cart'}
              title={isSoldOut ? 'Sold out' : 'Add to cart'}
              onClick={() => handleOpenQuantitySheet('cart')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="9" cy="20" r="1.5" fill="currentColor" />
                <circle cx="18" cy="20" r="1.5" fill="currentColor" />
                <path d="M3 4h2l2.3 9.2a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L20 7H7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">Add to cart</span>
            </button>
            <button
              type="button"
              className="button button-primary product-card-action-icon"
              disabled={isSoldOut || busyAction !== ''}
              aria-label={isSoldOut ? 'Sold out' : 'Buy now'}
              title={isSoldOut ? 'Sold out' : 'Buy now'}
              onClick={() => handleOpenQuantitySheet('buy')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 9V7a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 9h14l-1 10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m10 14 2 2 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">Buy now</span>
            </button>
          </div>
          <p className={`product-card-feedback${actionError ? ' error' : actionMessage ? ' success' : ''}`} role="status" aria-live="polite">
            {feedbackMessage}
          </p>
        </div>
      </article>

      {actionSheet}
    </>
  )
}

export default ProductCard