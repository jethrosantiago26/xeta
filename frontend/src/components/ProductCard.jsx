import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'
import { formatMoney } from '../lib/format.js'
import { normalizeDisplayText, resolveProductImage } from '../lib/orderItemMedia.js'
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
  const { isWishlisted, toggleItem } = useWishlist()

  const visualVariants = useMemo(() => {
    const sortedVariants = [...(product.variants ?? [])].sort((left, right) => Number(left.price) - Number(right.price))

    return sortedVariants.map((variant, index) => ({
      ...variant,
      visual: getVariantVisual(variant, {
        index,
        productName: normalizeDisplayText(product.name),
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
  const [showQuickView, setShowQuickView] = useState(false)
  const [quickViewQuantity, setQuickViewQuantity] = useState(1)
  const [quickViewBusy, setQuickViewBusy] = useState(false)
  const [wishlistBusy, setWishlistBusy] = useState(false)

  const selectedVariant = useMemo(() => {
    return visualVariants.find((variant) => String(variant.id) === selectedVariantId)
      ?? visualVariants[0]
      ?? null
  }, [visualVariants, selectedVariantId])

  const productPath = `/products/${product.slug}`
  const isRowLayout = layout === 'row'
  const image = resolveProductImage(product, { variant: selectedVariant })
  const productName = normalizeDisplayText(product.name) || 'Product'
  const selectedVariantName = normalizeDisplayText(selectedVariant?.name) || 'Standard variant'
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
  const inWishlist = isWishlisted(product)
  const wishlistLabel = inWishlist ? 'Remove from wishlist' : 'Save to wishlist'

  function getVariantNameLabel(variant) {
    return normalizeDisplayText(variant?.name) || 'Variant'
  }

  useEffect(() => {
    if (!showQuickView) {
      return
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShowQuickView(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showQuickView])

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

  async function handleToggleWishlist(event) {
    event.stopPropagation()

    if (wishlistBusy) {
      return
    }

    setWishlistBusy(true)

    try {
      const result = await toggleItem(product, selectedVariant?.id)

      if (!result.ok) {
        setActionMessage('')
        setActionError(result.reason === 'auth'
          ? 'Sign in first to save products to your wishlist.'
          : 'Unable to update your wishlist right now.')
        return
      }

      setActionError('')
      setActionMessage(result.saved ? 'Saved to wishlist.' : 'Removed from wishlist.')
    } finally {
      setWishlistBusy(false)
    }
  }

  function handleOpenQuickView(event) {
    event.stopPropagation()
    setActionMessage('')
    setActionError('')
    setQuickViewQuantity(1)
    setShowQuickView(true)
  }

  function closeQuickView() {
    if (quickViewBusy) {
      return
    }

    setShowQuickView(false)
  }

  async function handleQuickViewAddToCart() {
    if (!selectedVariant || selectedVariant.stock_quantity <= 0) {
      setActionMessage('')
      setActionError('This variant is currently unavailable.')
      return
    }

    const safeQuantity = Math.max(1, Math.min(quickViewQuantity, selectedVariant.stock_quantity))

    setQuickViewBusy(true)
    setActionMessage('')
    setActionError('')

    try {
      await addItem(selectedVariant.id, safeQuantity)
      setActionMessage(`Added ${safeQuantity} item${safeQuantity > 1 ? 's' : ''} to cart.`)
      setShowQuickView(false)
    } catch {
      setActionError('Sign in first to add this item to your cart.')
    } finally {
      setQuickViewBusy(false)
    }
  }

  function handleQuickViewOpenProduct() {
    setShowQuickView(false)
    navigate(productPath)
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
                alt={selectedVariantName}
                className="cart-bottom-sheet-visual"
              />
              <div className="cart-bottom-sheet-details">
                <h3 style={{ margin: 0, fontSize: '18px' }}>{productName}</h3>
                <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
                  {selectedVariantName} · {formatMoney(price)}
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

  const quickViewModal = showQuickView ? createPortal(
        <div
          className="quick-view-backdrop open"
          onClick={closeQuickView}
        >
          <div
            className="quick-view-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Quick view: ${productName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="quick-view-close"
              aria-label="Close quick view"
              onClick={closeQuickView}
              disabled={quickViewBusy}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="quick-view-media">
              <img src={image} alt={productName} loading="lazy" decoding="async" />
            </div>

            <div className="quick-view-content">
              <p className="quick-view-kicker">{product.category?.name ?? 'Peripherals'}</p>
              <h3 className="quick-view-title">{productName}</h3>
              <p className="quick-view-price">{priceLabel}</p>

              {hasMultipleVariants ? (
                <div className="quick-view-block">
                  <p className="quick-view-label">Color</p>
                  <div className="quick-view-color-options" role="radiogroup" aria-label={`Choose ${productName} color`}>
                    {visualVariants.map((variant) => {
                      const isActive = String(variant.id) === String(selectedVariant?.id ?? '')
                      const variantName = getVariantNameLabel(variant)

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          aria-label={variantName}
                          title={variantName}
                          className={`quick-view-color-dot${isActive ? ' active' : ''}`}
                          style={{
                            '--variant-color': variant.visual.color,
                            '--variant-ring': variant.visual.ringColor,
                            '--variant-ink': variant.visual.textColor,
                          }}
                          onClick={() => setSelectedVariantId(String(variant.id))}
                          disabled={quickViewBusy}
                        />
                      )
                    })}
                  </div>
                  {selectedVariant ? <p className="quick-view-selected-color">{selectedVariantName}</p> : null}
                </div>
              ) : null}

              {selectedVariant ? (
                <p className={`quick-view-stock${selectedVariant.stock_quantity > 0 ? '' : ' out'}`}>
                  {selectedVariant.stock_quantity > 0
                    ? `In stock (${selectedVariant.stock_quantity} available)`
                    : 'Currently out of stock'}
                </p>
              ) : null}

              <div className="quick-view-qty-row">
                <span>Quantity</span>
                <div className="quick-view-stepper">
                  <button
                    type="button"
                    onClick={() => setQuickViewQuantity((quantity) => Math.max(1, quantity - 1))}
                    disabled={quickViewBusy || quickViewQuantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <span>{quickViewQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuickViewQuantity((quantity) => Math.min(selectedVariant?.stock_quantity || 1, quantity + 1))}
                    disabled={quickViewBusy || quickViewQuantity >= (selectedVariant?.stock_quantity || 1)}
                    aria-label="Increase quantity"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="quick-view-subtotal">
                Subtotal: <strong>{formatMoney(price * Math.max(1, quickViewQuantity))}</strong>
              </p>

              <div className="quick-view-actions">
                <button
                  type="button"
                  className="button button-primary quick-view-add-button"
                  disabled={quickViewBusy || isSoldOut}
                  onClick={handleQuickViewAddToCart}
                >
                  {quickViewBusy ? 'Adding to cart...' : 'Add to cart'}
                </button>

                <button
                  type="button"
                  className={`quick-view-wishlist-button${inWishlist ? ' active' : ''}`}
                  onClick={handleToggleWishlist}
                  aria-label={wishlistLabel}
                  title={wishlistLabel}
                  disabled={quickViewBusy || wishlistBusy}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 20.2 10.7 19C5.8 14.5 2.5 11.5 2.5 7.8A4.8 4.8 0 0 1 7.3 3a5.3 5.3 0 0 1 4.7 2.6A5.3 5.3 0 0 1 16.7 3a4.8 4.8 0 0 1 4.8 4.8c0 3.7-3.3 6.7-8.2 11.2Z" fill={inWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <button type="button" className="button button-secondary quick-view-open-product" onClick={handleQuickViewOpenProduct}>
                Open full product page
              </button>

              {feedbackMessage ? (
                <p className={`quick-view-feedback${actionError ? ' error' : actionMessage ? ' success' : ''}`} role="status" aria-live="polite">
                  {feedbackMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null

  if (isRowLayout) {
    return (
      <>
        <article
          className="product-card product-card-row product-card-clickable"
          role="link"
          tabIndex={0}
          aria-label={`View ${productName}`}
          onClick={handleCardNavigate}
          onKeyDown={handleCardKeyDown}
        >
          <div className="product-card-media product-card-row-media">
            <img
              src={image}
              alt={productName}
              loading={prioritizeImage ? 'eager' : 'lazy'}
              fetchPriority={imageFetchPriority}
              decoding="async"
            />

            <div className="product-card-hover-actions" aria-label="Quick product actions">
              <button
                type="button"
                className={`product-card-hover-icon${inWishlist ? ' active' : ''}`}
                aria-label={wishlistLabel}
                title={wishlistLabel}
                onClick={handleToggleWishlist}
                disabled={wishlistBusy}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 20.2 10.7 19C5.8 14.5 2.5 11.5 2.5 7.8A4.8 4.8 0 0 1 7.3 3a5.3 5.3 0 0 1 4.7 2.6A5.3 5.3 0 0 1 16.7 3a4.8 4.8 0 0 1 4.8 4.8c0 3.7-3.3 6.7-8.2 11.2Z" fill={inWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">{wishlistLabel}</span>
              </button>

              <button
                type="button"
                className="product-card-hover-icon"
                aria-label="Quick view"
                title="Quick view"
                onClick={handleOpenQuickView}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M1.5 12s3.7-6 10.5-6 10.5 6 10.5 6-3.7 6-10.5 6S1.5 12 1.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                <span className="sr-only">Quick view</span>
              </button>
            </div>
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

            <h3 className="product-card-row-title">{productName}</h3>
            <p className="product-card-row-description">
              {product.description?.slice(0, 200) || 'High quality peripherals for work and play.'}
            </p>

            <div className="row product-card-row-price-row" style={{ justifyContent: 'space-between' }}>
              <strong className="price">{priceLabel}</strong>
              {selectedVariant ? (
                <span className="product-card-row-variant-label">{selectedVariantName}</span>
              ) : null}
            </div>
          </div>

          <div className="product-card-row-actions">
            {hasMultipleVariants ? (
              <div className="product-card-variant-row">
                <div className="product-card-variant-menu" role="radiogroup" aria-label={`Choose ${productName} variant preview`}>
                  {visualVariants.map((variant) => {
                    const isActive = String(variant.id) === String(selectedVariant?.id ?? '')
                    const variantName = getVariantNameLabel(variant)

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={`${variantName} ${formatMoney(variant.price)}`}
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
        {quickViewModal}
      </>
    )
  }

  return (
    <>
      <article
        className={`product-card product-card-clickable${uniformCardDesign ? ' product-card-uniform' : ''}`}
        role="link"
        tabIndex={0}
        aria-label={`View ${productName}`}
        onClick={handleCardNavigate}
        onKeyDown={handleCardKeyDown}
      >
        <div className="product-card-media">
          <img
            src={image}
            alt={productName}
            loading={prioritizeImage ? 'eager' : 'lazy'}
            fetchPriority={imageFetchPriority}
            decoding="async"
          />

          <div className="product-card-hover-actions" aria-label="Quick product actions">
            <button
              type="button"
              className={`product-card-hover-icon${inWishlist ? ' active' : ''}`}
              aria-label={wishlistLabel}
              title={wishlistLabel}
              onClick={handleToggleWishlist}
              disabled={wishlistBusy}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 20.2 10.7 19C5.8 14.5 2.5 11.5 2.5 7.8A4.8 4.8 0 0 1 7.3 3a5.3 5.3 0 0 1 4.7 2.6A5.3 5.3 0 0 1 16.7 3a4.8 4.8 0 0 1 4.8 4.8c0 3.7-3.3 6.7-8.2 11.2Z" fill={inWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">{wishlistLabel}</span>
            </button>

            <button
              type="button"
              className="product-card-hover-icon"
              aria-label="Quick view"
              title="Quick view"
              onClick={handleOpenQuickView}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M1.5 12s3.7-6 10.5-6 10.5 6 10.5 6-3.7 6-10.5 6S1.5 12 1.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
              </svg>
              <span className="sr-only">Quick view</span>
            </button>
          </div>
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
          <h2 style={{ fontSize: '13px', lineHeight: 1.35 }}>{productName}</h2>
          {showDescription ? (
            <p className="muted" style={{ fontSize: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {product.description?.slice(0, 100) || 'High quality peripherals for work and play.'}
            </p>
          ) : null}
          <div className="product-card-variant-row">
            {hasMultipleVariants ? (
              <div className="product-card-variant-menu" role="radiogroup" aria-label={`Choose ${productName} variant preview`}>
                {visualVariants.map((variant) => {
                  const isActive = String(variant.id) === String(selectedVariant?.id ?? '')
                  const variantName = getVariantNameLabel(variant)

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={`${variantName} ${formatMoney(variant.price)}`}
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
            <button
              type="button"
              className={`button button-secondary product-card-action-icon product-card-mobile-wishlist${inWishlist ? ' active' : ''}`}
              disabled={wishlistBusy}
              aria-label={wishlistLabel}
              title={wishlistLabel}
              onClick={handleToggleWishlist}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 20.2 10.7 19C5.8 14.5 2.5 11.5 2.5 7.8A4.8 4.8 0 0 1 7.3 3a5.3 5.3 0 0 1 4.7 2.6A5.3 5.3 0 0 1 16.7 3a4.8 4.8 0 0 1 4.8 4.8c0 3.7-3.3 6.7-8.2 11.2Z" fill={inWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">{wishlistLabel}</span>
            </button>
          </div>
          <p className={`product-card-feedback${actionError ? ' error' : actionMessage ? ' success' : ''}`} role="status" aria-live="polite">
            {feedbackMessage}
          </p>
        </div>
      </article>

      {actionSheet}
      {quickViewModal}
    </>
  )
}

export default ProductCard