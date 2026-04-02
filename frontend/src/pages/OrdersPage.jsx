import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useSession } from '../context/SessionContext.jsx'
import { getOrders, readResource } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'

const REFRESH_INTERVAL_MS = 12000

function getOrderItemImage(item) {
  return item?.variant?.image_url || item?.product?.image_url || '/vite.svg'
}

function formatRatingStars(ratingValue) {
  const safeRating = Math.max(1, Math.min(5, Number(ratingValue) || 0))
  return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`
}

function OrderTracker({ currentStatus, createdOn }) {
  const steps = ['pending', 'processing', 'shipped', 'delivered']
  
  if (currentStatus === 'cancelled') {
    return (
      <div className="order-tracker-cancelled">
        <span className="pill pill-error">Cancelled</span>
      </div>
    )
  }

  const statusMap = {
    pending: 'Order Placed',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered'
  }

  const currentIndex = steps.indexOf(currentStatus)
  
  return (
    <div className="order-tracker">
      {steps.map((step, idx) => {
        const isActive = idx <= currentIndex
        const isLast = idx === steps.length - 1
        
        return (
          <div key={step} className={`tracker-step ${isActive ? 'active' : ''} ${isLast ? 'last' : ''}`}>
            <div className="tracker-line-container">
              <div className="tracker-dot"></div>
              {!isLast && <div className="tracker-line"></div>}
            </div>
            <div className="tracker-content">
              <span className="tracker-label">{statusMap[step]}</span>
              {step === 'pending' && <span className="tracker-date">{new Date(createdOn).toLocaleDateString()}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrdersPage() {
  const { isLoaded, isSignedIn, loading: sessionLoading } = useSession()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const loadOrders = useCallback(async ({ background = false } = {}) => {
    if (!isLoaded || sessionLoading) {
      return
    }

    if (!isSignedIn) {
      setOrders([])
      setLoading(false)
      setError('')
      return
    }

    if (!background) {
      setLoading(true)
      setError('')
    }

    try {
      const response = await getOrders({ per_page: 10 })
      const payload = readResource(response)
      const records = Array.isArray(payload?.data)
        ? payload.data
        : (payload?.data?.data ?? [])

      setOrders(records)
    } catch (requestError) {
      if (!background) {
        setOrders([])
        setError(requestError?.response?.data?.message || 'Orders could not be loaded right now. Please retry.')
      }
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, [isLoaded, isSignedIn, sessionLoading])

  useEffect(() => {
    let active = true

    async function boot() {
      if (!active) {
        return
      }

      await loadOrders()
    }

    function refreshVisibleData() {
      if (document.hidden || !active) {
        return
      }

      loadOrders({ background: true })
    }

    boot()

    const intervalId = window.setInterval(refreshVisibleData, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshVisibleData)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVisibleData)
    }
  }, [loadOrders, reloadKey])

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Purchases"
        title="Orders"
        description="Track your purchases and their current status."
      />

      {loading ? <div className="notice">Loading orders...</div> : null}
      {error ? (
        <div className="notice error">
          {error}
          <div className="actions" style={{ marginTop: '8px' }}>
            <button type="button" className="button button-secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry loading orders
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid">
        {orders.length === 0 ? (
          <div className="content-card">
            <h2>No orders yet.</h2>
            <p className="muted">Once a checkout completes, your order history appears here.</p>
            <Link className="button button-primary" to="/products">
              Start shopping
            </Link>
          </div>
        ) : (
          orders.map((order) => (
            <article key={order.id} className="content-card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>{order.order_number}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                    {order.items?.length || 0} items for {formatMoney(order.total)}
                  </p>
                </div>
                {/* Visual Tracker renders on the right side on desktop or stacks on mobile */}
              </div>
              <div style={{ marginTop: '24px', marginBottom: '8px' }}>
                <OrderTracker currentStatus={order.status} createdOn={order.created_at} />
              </div>
              <div className="divider" />
              <div className="order-items-panel">
                <p className="muted order-items-heading">Products in this order</p>
                <div className="order-items-scroll">
                  {(order.items ?? []).length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>Item details are not available for this order.</p>
                  ) : (
                    (order.items ?? []).map((item) => {
                      const productSlug = item?.product?.slug
                      const itemReview = item?.review
                      const productLink = productSlug ? `/products/${productSlug}` : null

                      return (
                        <div key={item.id} className="order-item-card">
                          <img
                            src={getOrderItemImage(item)}
                            alt={item.product_name}
                            className="order-item-thumb"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="order-item-content">
                            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <p className="order-item-name">{item.product_name}</p>
                                <p className="muted order-item-variant">{item.variant_name}</p>
                              </div>
                              <p className="order-item-total">{formatMoney(item.total)}</p>
                            </div>

                            <div className="row" style={{ justifyContent: 'space-between' }}>
                              <p className="muted order-item-meta">Qty {item.quantity} · {formatMoney(item.unit_price)} each</p>
                              {productLink ? (
                                <Link className="order-item-link" to={productLink}>
                                  View
                                </Link>
                              ) : null}
                            </div>

                            {itemReview && productLink ? (
                              <Link className="order-item-review-link" to={productLink} title="Open product page">
                                <div className="order-item-review-row">
                                  <span className="order-item-review-label">Your review</span>
                                  <span className="order-item-review-stars">{formatRatingStars(itemReview.rating)}</span>
                                </div>
                                <p className="order-item-review-text">
                                  {itemReview.comment?.trim() || 'No written comment.'}
                                </p>
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Total</span>
                <strong>{formatMoney(order.total)}</strong>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}

export default OrdersPage