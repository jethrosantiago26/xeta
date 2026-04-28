import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useSession } from '../context/SessionContext.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'
import { createReview, getOrders, getProduct, readResource, updateReview } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { normalizeDisplayText, resolveProductImage } from '../lib/orderItemMedia.js'
import { getVariantVisual } from '../lib/variantVisuals.js'

function formatSpecLabel(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolvePreferredVariantId(variants, preferredVariantId = '') {
  if (!Array.isArray(variants) || variants.length === 0) {
    return ''
  }

  if (preferredVariantId && variants.some((variant) => String(variant.id) === String(preferredVariantId))) {
    return String(preferredVariantId)
  }

  const firstInStockVariant = variants.find((variant) => Number(variant?.stock_quantity ?? 0) > 0)

  return String(firstInStockVariant?.id ?? variants[0]?.id ?? '')
}

function ProductDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { isWishlisted, toggleItem } = useWishlist()
  const [product, setProduct] = useState(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [adding, setAdding] = useState(false)
  const [wishlistBusy, setWishlistBusy] = useState(false)
  
  // Cart Bottom Sheet state
  const [showCartSheet, setShowCartSheet] = useState(false)
  const [cartQuantity, setCartQuantity] = useState(1)
  const [sheetAction, setSheetAction] = useState('cart')

  // Reviews state
  const { profile, isLoaded: sessionLoaded, isSignedIn } = useSession()
  const [reviews, setReviews] = useState([])
  const [userOrders, setUserOrders] = useState([])
  const [reviewVariantId, setReviewVariantId] = useState('')
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', is_anonymous: false })
  const [isEditingReview, setIsEditingReview] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    let active = true

    async function loadProduct() {
      setLoading(true)

      try {
        const response = await getProduct(slug)
        const payload = readResource(response)
        const productData = payload.data ?? payload

        if (active) {
          setProduct(productData)
          setReviews(productData.reviews ?? [])
          setSelectedVariantId(resolvePreferredVariantId(productData?.variants ?? []))
        }
      } catch {
        if (active) {
          setProduct(null)
          setSelectedVariantId('')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadProduct()

    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    let active = true
    async function fetchOrders() {
      if (!sessionLoaded || !isSignedIn) return
      try {
        const response = await getOrders({ per_page: 50 })
        const payload = readResource(response)
        const records = Array.isArray(payload?.data) ? payload.data : (payload?.data?.data ?? [])
        if (active) setUserOrders(records)
      } catch {
        // quiet fail
      }
    }
    fetchOrders()
    return () => { active = false }
  }, [sessionLoaded, isSignedIn])

  const orderedVariantChoices = useMemo(() => {
    if (!product?.id) {
      return []
    }

    const choicesByVariant = new Map()

    for (const order of userOrders) {
      if (order?.status === 'cancelled') {
        continue
      }

      for (const item of order?.items || []) {
        if (item?.product?.id !== product.id || !item?.variant?.id) {
          continue
        }

        const variantId = String(item.variant.id)
        if (choicesByVariant.has(variantId)) {
          continue
        }

        choicesByVariant.set(variantId, {
          variantId,
          variantName: item.variant?.name || item.variant_name || `Variant #${variantId}`,
          orderId: order.id,
          orderNumber: order.order_number,
        })
      }
    }

    return Array.from(choicesByVariant.values())
  }, [product?.id, userOrders])

  const myReviewsByVariantId = useMemo(() => {
    const map = new Map()

    if (!profile?.id) {
      return map
    }

    for (const review of reviews) {
      if (review?.user_id !== profile.id || !review?.variant_id) {
        continue
      }

      map.set(String(review.variant_id), review)
    }

    return map
  }, [reviews, profile?.id])

  const selectedReviewVariant = useMemo(() => {
    return orderedVariantChoices.find((choice) => choice.variantId === reviewVariantId) || null
  }, [orderedVariantChoices, reviewVariantId])

  const selectedVariantReview = useMemo(() => {
    if (!reviewVariantId) {
      return null
    }

    return myReviewsByVariantId.get(reviewVariantId) || null
  }, [myReviewsByVariantId, reviewVariantId])

  useEffect(() => {
    if (orderedVariantChoices.length === 0) {
      setReviewVariantId('')
      return
    }

    setReviewVariantId((current) => {
      if (orderedVariantChoices.some((choice) => choice.variantId === current)) {
        return current
      }

      return orderedVariantChoices[0].variantId
    })
  }, [orderedVariantChoices])

  useEffect(() => {
    if (selectedVariantReview) {
      setReviewForm({
        rating: selectedVariantReview.rating,
        comment: selectedVariantReview.comment || '',
        is_anonymous: selectedVariantReview.is_anonymous,
      })
    } else {
      setReviewForm({ rating: 5, comment: '', is_anonymous: false })
    }

    setIsEditingReview(false)
    setReviewError('')
  }, [selectedVariantReview, reviewVariantId])

  async function handleReviewSubmit(e) {
    e.preventDefault()

    if (!reviewVariantId || !selectedReviewVariant) {
      setReviewError('Select a purchased variant before submitting your review.')
      return
    }

    setReviewError('')
    setSubmittingReview(true)

    try {
      const createPayload = {
        order_id: selectedReviewVariant.orderId,
        variant_id: Number(reviewVariantId),
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        is_anonymous: reviewForm.is_anonymous,
      }

      const updatePayload = {
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        is_anonymous: reviewForm.is_anonymous,
      }

      if (selectedVariantReview) {
        const response = await updateReview(product.slug, selectedVariantReview.id, updatePayload)
        const responsePayload = readResource(response)
        const updatedReview = responsePayload.review ?? responsePayload.data ?? responsePayload
        setReviews((curr) => curr.map(r => r.id === updatedReview.id ? updatedReview : r))
        setActionMessage('Variant review updated successfully.')
        setIsEditingReview(false)
        setTimeout(() => setActionMessage(''), 3000)
      } else {
        const response = await createReview(product.slug, createPayload)
        const responsePayload = readResource(response)
        const newReview = responsePayload.review ?? responsePayload.data ?? responsePayload
        setReviews((curr) => [newReview, ...curr])
        setActionMessage('Variant review submitted successfully.')
        setTimeout(() => setActionMessage(''), 3000)
      }
    } catch (error) {
      setReviewError(error?.response?.data?.message || 'Failed to submit review.')
    } finally {
      setSubmittingReview(false)
    }
  }

  const visualVariants = useMemo(() => {
    return (product?.variants ?? []).map((variant, index) => ({
      ...variant,
      visual: getVariantVisual(variant, {
        index,
        productName: product?.name,
      }),
    }))
  }, [product])

  const selectedVariant = useMemo(() => {
    return visualVariants.find((variant) => String(variant.id) === selectedVariantId)
      ?? visualVariants[0]
      ?? null
  }, [visualVariants, selectedVariantId])

  useEffect(() => {
    setSelectedVariantId((currentVariantId) => resolvePreferredVariantId(visualVariants, currentVariantId))
  }, [visualVariants])

  const specEntries = useMemo(() => {
    if (!product?.specs || typeof product.specs !== 'object') {
      return []
    }

    return Object.entries(product.specs)
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([key, value]) => ({
        key,
        label: formatSpecLabel(key),
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      }))
  }, [product?.specs])

  const approvedReviews = useMemo(() => {
    return reviews.filter((review) => review?.is_approved !== false)
  }, [reviews])

  const totalRatings = approvedReviews.length
  const averageRating = totalRatings > 0
    ? approvedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / totalRatings
    : 0
  const roundedAverage = Math.round(averageRating)
  const productWishlisted = product ? isWishlisted(product) : false
  const wishlistActionLabel = productWishlisted ? 'Remove from wishlist' : 'Save to wishlist'

  async function handleToggleWishlist() {
    if (!product) {
      return
    }

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

  if (loading) {
    return (
      <div className="page-grid">
        <section className="content-card">
          <p className="notice">Loading product...</p>
        </section>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="page-grid">
        <section className="content-card">
          <h1>Product not found</h1>
          <p className="muted">The requested product could not be loaded.</p>
          <Link className="button button-primary" to="/products">
            Back to products
          </Link>
        </section>
      </div>
    )
  }

  const image = resolveProductImage(product, { variant: selectedVariant })
  const productName = normalizeDisplayText(product.name) || 'Product'
  const selectedVariantName = normalizeDisplayText(selectedVariant?.name) || 'Standard variant'
  const price = Number(
    selectedVariant?.sale_price
    ?? selectedVariant?.final_price
    ?? selectedVariant?.price
    ?? product.lowest_sale_price
    ?? product.lowest_price
    ?? 0,
  )
  const baselinePrice = Number(selectedVariant?.price ?? product.lowest_original_price ?? product.lowest_price ?? price)
  const compareAtPrice = Number(selectedVariant?.compare_at_price ?? 0)
  const originalPrice = compareAtPrice > baselinePrice ? compareAtPrice : baselinePrice
  const hasSalePricing = originalPrice > price && price > 0
  const computedSalePercent = hasSalePricing ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0
  const saleLabel = selectedVariant?.sale_label || product.sale?.label || (computedSalePercent > 0 ? `${computedSalePercent}% OFF` : null)

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div className="hero-media">
          <img src={image} alt={productName} />
        </div>

        <div className="stack">
          <p className="eyebrow">{product.category?.name ?? 'Peripheral'}</p>
          <h1>{productName}</h1>
          <p className="lede">{product.description}</p>
          <div className="row">
            <span className="price">{formatMoney(price)}</span>
            {hasSalePricing ? <span className="muted" style={{ textDecoration: 'line-through' }}>{formatMoney(originalPrice)}</span> : null}
            {saleLabel ? <span className="status-pill success">{saleLabel}</span> : null}
            {totalRatings > 0 ? (
              <span className="status-pill">{averageRating.toFixed(1)} / 5</span>
            ) : null}
            {totalRatings > 0 ? (
              <span className="status-pill warning">{totalRatings} reviews</span>
            ) : null}
          </div>

          <div className="stack variant-selector">
            <p className="muted variant-selector-label">Variant finish</p>
            <div className="variant-meatballs" role="radiogroup" aria-label="Choose product variant">
              {visualVariants.map((variant) => {
                const isActive = String(variant.id) === String(selectedVariant?.id ?? '')
                const variantName = normalizeDisplayText(variant.name) || 'Variant'

                return (
                  <button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-label={`${variantName} ${formatMoney(variant.sale_price ?? variant.final_price ?? variant.price)}`}
                    className={`variant-meatball${isActive ? ' active' : ''}`}
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
            {selectedVariant ? (
              <div className="variant-selection-summary">
                <span>{selectedVariantName}</span>
                <span>{formatMoney(price)}</span>
              </div>
            ) : null}
          </div>

          {selectedVariant ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="muted" style={{ margin: 0 }}>
                Selected: {selectedVariantName}
              </p>
              
              <div className="stock-status" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
                {selectedVariant.stock_quantity > 0 ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span style={{ color: '#10b981' }}>In Stock. <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>Ready to ship.</span></span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <span style={{ color: '#ef4444' }}>Currently Unavailable.</span>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {actionError ? <div className="notice error">{actionError}</div> : null}
          {actionMessage ? <div className="notice success">{actionMessage}</div> : null}

          <div className="actions">
            <button
              type="button"
              className="button button-primary"
              disabled={!selectedVariant || selectedVariant.stock_quantity === 0}
              onClick={() => {
                if (!selectedVariant || selectedVariant.stock_quantity === 0) return
                setSheetAction('cart')
                setCartQuantity(1)
                setShowCartSheet(true)
              }}
            >
              {selectedVariant?.stock_quantity === 0 ? 'Sold Out' : 'Add to cart'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={!selectedVariant || selectedVariant.stock_quantity === 0}
              onClick={() => {
                if (!selectedVariant || selectedVariant.stock_quantity === 0) return
                setSheetAction('buy')
                setCartQuantity(1)
                setShowCartSheet(true)
              }}
            >
              {selectedVariant?.stock_quantity === 0 ? 'Sold Out' : 'Buy now'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={wishlistBusy}
              onClick={handleToggleWishlist}
              aria-label={wishlistActionLabel}
              title={wishlistActionLabel}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ width: '16px', height: '16px' }}>
                <path d="M12 20.2 10.7 19C5.8 14.5 2.5 11.5 2.5 7.8A4.8 4.8 0 0 1 7.3 3a5.3 5.3 0 0 1 4.7 2.6A5.3 5.3 0 0 1 16.7 3a4.8 4.8 0 0 1 4.8 4.8c0 3.7-3.3 6.7-8.2 11.2Z" fill={productWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {productWishlisted ? 'Saved' : 'Wishlist'}
            </button>
            <Link className="button button-secondary" to="/cart">
              Go to cart
            </Link>
          </div>
        </div>
      </section>

      <section className="grid cards product-detail-info-grid">
        <div className="summary-card specs-card">
          <div className="specs-card-head">
            <p className="specs-card-kicker">Specifications</p>
            <h3>Technical details</h3>
          </div>
          <div className="divider" />
          {specEntries.length > 0 ? (
            <dl className="specs-list">
              {specEntries.map((spec) => (
                <div key={spec.key} className="specs-item">
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted specs-empty">No specifications listed yet.</p>
          )}
        </div>
      </section>

      {/* ── Reviews Section ── */}
      <section className="product-reviews-section">
        <div className="product-reviews-header">
          <div className="product-reviews-title">
            <h2>Customer Reviews</h2>
            <p className="muted">Feedback from verified purchases.</p>
          </div>

          <div className="review-summary-panel" aria-label="Review summary">
            <span className="review-summary-score">{totalRatings > 0 ? averageRating.toFixed(1) : '—'}</span>
            <div className="review-summary-meta">
              <div className="review-summary-stars" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <svg key={index} className={index < roundedAverage ? 'filled' : ''} viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              <span className="review-summary-count">
                {totalRatings > 0
                  ? `${totalRatings} rating${totalRatings === 1 ? '' : 's'}`
                  : 'No ratings yet'}
              </span>
            </div>
          </div>
        </div>

        <div className="reviews-layout">
          {/* Review List */}
          <div className="reviews-list">
            {reviews.length === 0 ? (
              <article className="review-empty-card">
                <h3>No reviews yet</h3>
                <p>Be the first verified buyer to share feedback on this product.</p>
              </article>
            ) : (
              reviews.map((review) => {
                const authorName = review.author_name || 'Verified Buyer'

                return (
                  <article key={review.id} className="review-card">
                    <div className="review-card-header">
                      <div className="review-author-group">
                        <span className="review-avatar">{authorName.charAt(0).toUpperCase()}</span>
                        <div className="review-author-meta">
                          <span className="review-author">{authorName}</span>
                          <span className="review-date">
                            {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="review-stars-display" aria-label={`Rated ${review.rating} out of 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} className={`star-icon ${i < review.rating ? 'filled' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ))}
                      </div>
                    </div>

                    {review.variant?.name ? (
                      <span className="review-variant-pill">{normalizeDisplayText(review.variant.name)}</span>
                    ) : null}

                    <p className={`review-comment${review.comment ? '' : ' review-comment-empty'}`}>
                      {review.comment || 'No written comment provided.'}
                    </p>
                  </article>
                )
              })
            )}
          </div>

          {/* Write Review Form */}
          <div className="review-form-container">
            {!isSignedIn ? (
              <div className="review-notice-card">
                <h3>Write a review</h3>
                <p>Sign in to leave feedback after purchase.</p>
                <Link className="button button-secondary" to="/account">Sign In</Link>
              </div>
            ) : orderedVariantChoices.length === 0 ? (
              <div className="review-notice-card disabled">
                <h3>Write a review</h3>
                <p>You can submit a review after purchasing this product.</p>
              </div>
            ) : (
              <div className="review-form-card">
                <label className="review-field">
                  <span className="review-field-label">Select purchased variant</span>
                  <select
                    className="select review-select"
                    value={reviewVariantId}
                    onChange={(event) => setReviewVariantId(event.target.value)}
                    required
                  >
                    {orderedVariantChoices.map((choice) => (
                      <option key={choice.variantId} value={choice.variantId}>
                        {choice.variantName} · {choice.orderNumber}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedVariantReview && !isEditingReview ? (
                  <div className="review-notice-card success">
                    <h3>Your review</h3>
                    <p>You already reviewed this variant.</p>

                    <div className="review-existing-content">
                      <div className="review-existing-stars" aria-hidden="true">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} viewBox="0 0 24 24" fill={i < selectedVariantReview.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={i < selectedVariantReview.rating ? '0' : '2'}>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ))}
                      </div>

                      <p className={`review-existing-comment${selectedVariantReview.comment ? '' : ' empty'}`}>
                        {selectedVariantReview.comment || 'No written comment provided.'}
                      </p>
                    </div>

                    <button type="button" className="button button-secondary" onClick={() => setIsEditingReview(true)}>
                      Edit your review
                    </button>
                  </div>
                ) : (
                  <form className="review-form" onSubmit={handleReviewSubmit}>
                    <h3>{selectedVariantReview ? 'Update your review' : 'Write a review'}</h3>
                    <p className="review-form-subtitle">
                      {selectedVariantReview
                        ? 'Edit your rating and comment for this variant.'
                        : 'Share your thoughts about this purchased variant.'}
                    </p>

                    {reviewError && <div className="notice error">{reviewError}</div>}

                    <div className="star-rating-selector" role="radiogroup" aria-label="Choose rating">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const ratingValue = i + 1

                        return (
                          <button
                            key={ratingValue}
                            type="button"
                            className={`star-select-btn ${ratingValue <= reviewForm.rating ? 'active' : ''}`}
                            onClick={() => setReviewForm(curr => ({ ...curr, rating: ratingValue }))}
                            aria-label={`Rate ${ratingValue} star${ratingValue > 1 ? 's' : ''}`}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </button>
                        )
                      })}
                    </div>

                    <textarea
                      className="textarea review-textarea"
                      placeholder="What did you like or dislike?"
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm(curr => ({ ...curr, comment: e.target.value }))}
                      required
                    />

                    <label className="review-anonymous-field" htmlFor="is_anonymous">
                      <input
                        type="checkbox"
                        id="is_anonymous"
                        checked={reviewForm.is_anonymous}
                        onChange={(e) => setReviewForm(curr => ({ ...curr, is_anonymous: e.target.checked }))}
                      />
                      <span>Post anonymously</span>
                    </label>

                    <div className="review-form-actions">
                      <button type="submit" className="button button-primary" disabled={submittingReview}>
                        {submittingReview ? 'Submitting...' : (selectedVariantReview ? 'Update review' : 'Submit review')}
                      </button>
                      {selectedVariantReview ? (
                        <button type="button" className="button button-secondary" disabled={submittingReview} onClick={() => setIsEditingReview(false)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Cart and Buy Bottom Sheet Drawer ── */}
      {selectedVariant && createPortal(
        <div 
          className={`cart-bottom-sheet-backdrop ${showCartSheet ? 'open' : ''}`}
          onClick={() => setShowCartSheet(false)}
        >
          <div 
            className="cart-bottom-sheet-container"
            onClick={(e) => e.stopPropagation()}
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
                  disabled={cartQuantity <= 1}
                  onClick={() => setCartQuantity(q => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <span>{cartQuantity}</span>
                <button 
                  disabled={cartQuantity >= selectedVariant.stock_quantity}
                  onClick={() => setCartQuantity(q => Math.min(selectedVariant.stock_quantity, q + 1))}
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
              disabled={adding || selectedVariant.stock_quantity === 0}
              onClick={async () => {
                setAdding(true)
                setActionError('')
                setActionMessage('')

                try {
                  await addItem(selectedVariant.id, cartQuantity)
                  if (sheetAction === 'buy') {
                    setShowCartSheet(false)
                    navigate('/checkout')
                    return
                  }

                  setActionMessage(`Added ${cartQuantity} item${cartQuantity > 1 ? 's' : ''} to cart.`)
                  setShowCartSheet(false)
                } catch {
                  setActionError(sheetAction === 'buy'
                    ? 'Sign in first to buy this item now.'
                    : 'Sign in first to add this item to your cart.')
                  setShowCartSheet(false)
                } finally {
                  setAdding(false)
                }
              }}
            >
              {adding
                ? (sheetAction === 'buy' ? 'Preparing checkout...' : 'Adding to cart...')
                : (sheetAction === 'buy'
                  ? `Buy now — ${formatMoney(price * cartQuantity)}`
                  : `Add to cart — ${formatMoney(price * cartQuantity)}`)}
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

export default ProductDetailPage
