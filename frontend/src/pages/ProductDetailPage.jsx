import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useSession } from '../context/SessionContext.jsx'
import { createReview, getOrders, getProduct, readResource, updateReview } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { getVariantVisual } from '../lib/variantVisuals.js'

function ProductDetailPage() {
  const { slug } = useParams()
  const { addItem } = useCart()
  const [product, setProduct] = useState(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [adding, setAdding] = useState(false)
  
  // Cart Bottom Sheet state
  const [showCartSheet, setShowCartSheet] = useState(false)
  const [cartQuantity, setCartQuantity] = useState(1)

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
          setSelectedVariantId(String(productData?.variants?.[0]?.id ?? ''))
        }
      } catch (error) {
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
  }, [selectedVariantReview?.id, reviewVariantId])

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

  const image = selectedVariant?.visual?.image || product.primary_image || product.images?.[0]?.url || '/vite.svg'
  const price = selectedVariant?.price ?? product.lowest_price ?? 0

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div className="hero-media">
          <img src={image} alt={product.name} />
        </div>

        <div className="stack">
          <p className="eyebrow">{product.category?.name ?? 'Peripheral'}</p>
          <h1>{product.name}</h1>
          <p className="lede">{product.description}</p>
          <div className="row">
            <span className="price">{formatMoney(price)}</span>
            {product.average_rating ? (
              <span className="status-pill">{Number(product.average_rating).toFixed(1)} / 5</span>
            ) : null}
            {product.review_count ? (
              <span className="status-pill warning">{product.review_count} reviews</span>
            ) : null}
          </div>

          <div className="stack variant-selector">
            <p className="muted variant-selector-label">Variant finish</p>
            <div className="variant-meatballs" role="radiogroup" aria-label="Choose product variant">
              {visualVariants.map((variant) => {
                const isActive = String(variant.id) === String(selectedVariant?.id ?? '')

                return (
                  <button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-label={`${variant.name} ${formatMoney(variant.price)}`}
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
                <span>{selectedVariant.name}</span>
                <span>{formatMoney(selectedVariant.price)}</span>
              </div>
            ) : null}
          </div>

          {selectedVariant ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="muted" style={{ margin: 0 }}>
                Selected: {selectedVariant.name}
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
                setCartQuantity(1)
                setShowCartSheet(true)
              }}
            >
              {selectedVariant?.stock_quantity === 0 ? 'Sold Out' : 'Add to cart'}
            </button>
            <Link className="button button-secondary" to="/cart">
              Go to cart
            </Link>
          </div>
        </div>
      </section>

      <section className="grid cards">
        <div className="summary-card">
          <h3>Specs</h3>
          <div className="divider" />
          <pre className="muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {JSON.stringify(product.specs ?? {}, null, 2)}
          </pre>
        </div>
        <div className="summary-card">
          <h3>Variants</h3>
          <div className="divider" />
          <div className="stack">
            {visualVariants.map((variant) => (
              <div key={variant.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{variant.name}</span>
                <span>{formatMoney(variant.price)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews Section ── */}
      <section className="product-reviews-section">
        <div className="product-reviews-header">
          <h2>Customer Reviews</h2>
          {product.average_rating ? (
            <div className="review-summary-stats">
              <span className="review-summary-score">{Number(product.average_rating).toFixed(1)}</span>
              <span className="review-summary-count">out of 5 ({product.review_count} ratings)</span>
            </div>
          ) : (
            <p className="muted">No reviews yet.</p>
          )}
        </div>

        <div className="reviews-layout">
          {/* Review List */}
          <div className="reviews-list">
            {reviews.map((review) => (
              <article key={review.id} className="review-card">
                <div className="review-card-header">
                  <span className="review-author">{review.author_name || 'Verified Buyer'}</span>
                  <div className="review-stars-display">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} className={`star-icon ${i < review.rating ? 'filled' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                </div>
                {review.variant?.name ? (
                  <p className="muted" style={{ margin: '2px 0 8px', fontSize: '12px' }}>
                    Variant: {review.variant.name}
                  </p>
                ) : null}
                {review.comment && <p className="review-comment">{review.comment}</p>}
                <span className="review-date">
                  {new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </article>
            ))}
          </div>

          {/* Write Review Form */}
          <div className="review-form-container">
            {!isSignedIn ? (
              <div className="review-notice-card">
                <p>Sign in to write a review.</p>
                <Link className="button button-secondary" to="/account">Sign In</Link>
              </div>
            ) : orderedVariantChoices.length === 0 ? (
              <div className="review-notice-card disabled">
                <p>You can only review variants you have purchased.</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: '12px' }}>
                <label className="stack" style={{ gap: '6px' }}>
                  <span className="muted" style={{ fontSize: '12px' }}>Select purchased variant</span>
                  <select
                    className="select"
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
              <div className="review-notice-card success" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Your Review</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    You have already reviewed this variant.
                  </p>
                </div>

                <div style={{ backgroundColor: 'var(--color-surface)', padding: '16px', borderRadius: '12px', width: '100%', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '12px', color: 'var(--color-accent)' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < selectedVariantReview.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={i < selectedVariantReview.rating ? '0' : '2'}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', fontStyle: selectedVariantReview.comment ? 'normal' : 'italic', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
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
                <p className="muted" style={{ fontSize: '13px', marginTop: '-4px' }}>
                  {selectedVariantReview
                    ? 'Edit the stars and text below for this variant.'
                    : 'Share your thoughts about this purchased variant.'}
                </p>

                {reviewError && <div className="notice error">{reviewError}</div>}

                <div className="star-rating-selector">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const ratingValue = i + 1
                    return (
                      <button
                        key={ratingValue}
                        type="button"
                        className={`star-select-btn ${ratingValue <= reviewForm.rating ? 'active' : ''}`}
                        onClick={() => setReviewForm(curr => ({ ...curr, rating: ratingValue }))}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    )
                  })}
                </div>

                <textarea
                  className="textarea"
                  placeholder="What did you like or dislike?"
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm(curr => ({ ...curr, comment: e.target.value }))}
                  required
                />

                <div className="checkbox-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="is_anonymous"
                    checked={reviewForm.is_anonymous}
                    onChange={(e) => setReviewForm(curr => ({ ...curr, is_anonymous: e.target.checked }))}
                    style={{ accentColor: 'var(--brand-500)', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="is_anonymous" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                    Post anonymously
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="button button-primary" disabled={submittingReview}>
                    {submittingReview ? 'Submitting...' : (selectedVariantReview ? 'Update review' : 'Submit review')}
                  </button>
                  {selectedVariantReview && (
                    <button type="button" className="button button-secondary" disabled={submittingReview} onClick={() => setIsEditingReview(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Add to Cart Bottom Sheet Drawer ── */}
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
                  setActionMessage(`Added ${cartQuantity} item${cartQuantity > 1 ? 's' : ''} to cart.`)
                  setShowCartSheet(false)
                } catch (error) {
                  setActionError('Sign in first to add this item to your cart.')
                  setShowCartSheet(false)
                } finally {
                  setAdding(false)
                }
              }}
            >
              {adding ? 'Adding to cart...' : `Add to cart — ${formatMoney(price * cartQuantity)}`}
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

export default ProductDetailPage