import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useSession } from '../context/SessionContext.jsx'
import { getOrders, readResource } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { normalizeOrderItemText, resolveOrderItemImage } from '../lib/orderItemMedia.js'

const REFRESH_INTERVAL_MS = 12000
const ORDER_STEPS = ['pending', 'processing', 'shipped', 'delivered']

const STATUS_LABELS = {
  pending: 'Order Placed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const ORDER_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

function normalizeOrderStatus(statusValue) {
  const normalized = String(statusValue || '').toLowerCase()

  if (normalized === 'in_progress' || normalized === 'paid') {
    return 'processing'
  }

  if (normalized === 'fulfilled' || normalized === 'completed') {
    return 'delivered'
  }

  return normalized || 'pending'
}

function formatOrderDate(dateValue) {
  if (!dateValue) {
    return 'Unknown date'
  }

  const parsed = new Date(dateValue)

  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date'
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRatingStars(ratingValue) {
  const safeRating = Math.max(1, Math.min(5, Number(ratingValue) || 0))
  return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`
}

function OrderTracker({ currentStatus, createdOn }) {
  const normalizedStatus = normalizeOrderStatus(currentStatus)

  if (normalizedStatus === 'cancelled') {
    return (
      <div className="order-tracker-cancelled">
        <span className="status-pill status-cancelled">Cancelled</span>
        <span className="tracker-date">Placed {formatOrderDate(createdOn)}</span>
      </div>
    )
  }

  const activeStatus = ORDER_STEPS.includes(normalizedStatus) ? normalizedStatus : 'pending'
  const currentIndex = ORDER_STEPS.indexOf(activeStatus)

  return (
    <div className="order-tracker-panel">
      <div className="order-tracker-steps">
        {ORDER_STEPS.map((step, idx) => {
          const isLast = idx === ORDER_STEPS.length - 1
          let stepState = 'upcoming'

          if (activeStatus === 'delivered' && idx <= currentIndex) {
            stepState = 'completed'
          } else if (idx < currentIndex) {
            stepState = 'completed'
          } else if (idx === currentIndex) {
            stepState = 'active'
          }

          return (
            <Fragment key={step}>
              <div className={`order-tracker-step order-tracker-step--${stepState}`}>
                <div className="order-tracker-icon" aria-hidden="true">
                  {stepState === 'completed' ? '✓' : idx + 1}
                </div>
                <span className="order-tracker-label">{STATUS_LABELS[step]}</span>
                {step === 'pending' ? (
                  <span className="order-tracker-date">{formatOrderDate(createdOn)}</span>
                ) : null}
              </div>
              {!isLast ? (
                <div className={`order-tracker-connector${idx < currentIndex ? ' order-tracker-connector--filled' : ''}`} />
              ) : null}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function OrdersPage() {
  const { isLoaded, isSignedIn, loading: sessionLoading } = useSession()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [activeTab, setActiveTab] = useState('active')

  const segmentedOrders = useMemo(() => {
    const groups = {
      all: [],
      active: [],
      completed: [],
      cancelled: [],
    }

    for (const order of orders) {
      const status = normalizeOrderStatus(order.status)
      groups.all.push(order)

      if (status === 'delivered') {
        groups.completed.push(order)
      } else if (status === 'cancelled') {
        groups.cancelled.push(order)
      } else {
        groups.active.push(order)
      }
    }

    return groups
  }, [orders])

  const filteredOrders = segmentedOrders[activeTab] ?? segmentedOrders.all

  const orderCountByTab = {
    all: segmentedOrders.all.length,
    active: segmentedOrders.active.length,
    completed: segmentedOrders.completed.length,
    cancelled: segmentedOrders.cancelled.length,
  }

  const emptyMessageByTab = {
    all: 'No orders yet. Once a checkout completes, your order history appears here.',
    active: 'No active orders right now.',
    completed: 'No completed orders yet.',
    cancelled: 'No cancelled orders.',
  }

  useEffect(() => {
    if (activeTab !== 'active') {
      return
    }

    if (segmentedOrders.active.length === 0 && segmentedOrders.all.length > 0) {
      setActiveTab('all')
    }
  }, [activeTab, segmentedOrders.active.length, segmentedOrders.all.length])

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

      {orders.length > 0 ? (
        <div className="orders-filter-row">
          <div className="pipeline-tabs" role="tablist" aria-label="Order status filters">
            {ORDER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`pipeline-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="pipeline-tab-count">{orderCountByTab[tab.key]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="grid">
        {orders.length === 0 ? (
          <div className="content-card">
            <h2>No orders yet.</h2>
            <p className="muted">{emptyMessageByTab.all}</p>
            <Link className="button button-primary" to="/products">
              Start shopping
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="content-card">
            <h2>{activeTab === 'completed' ? 'No completed orders' : 'No orders in this view'}</h2>
            <p className="muted">{emptyMessageByTab[activeTab] ?? emptyMessageByTab.all}</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const normalizedStatus = normalizeOrderStatus(order.status)
            const orderItems = order.items ?? []
            const itemCount = orderItems.length

            return (
              <article key={order.id} className="content-card">
                <div className="order-card-head">
                  <div>
                    <h3 className="order-card-number">{order.order_number}</h3>
                    <p className="order-card-summary">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'} for {formatMoney(order.total)}
                    </p>
                  </div>
                  <div className="order-card-meta">
                    <span className={`status-pill status-${normalizedStatus}`}>
                      {STATUS_LABELS[normalizedStatus] ?? STATUS_LABELS.pending}
                    </span>
                    <p className="order-card-date">Placed {formatOrderDate(order.created_at)}</p>
                  </div>
                </div>

                <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                  <OrderTracker currentStatus={normalizedStatus} createdOn={order.created_at} />
                </div>

                <div className="divider" />

                <div className="order-items-panel">
                  <p className="muted order-items-heading">Products in this order</p>
                  <div className="order-items-scroll">
                    {orderItems.length === 0 ? (
                      <p className="muted" style={{ margin: 0 }}>Item details are not available for this order.</p>
                    ) : (
                      orderItems.map((item) => {
                        const productSlug = item?.product?.slug
                        const itemReview = item?.review
                        const productLink = productSlug ? `/products/${productSlug}` : null

                        return (
                          <div key={item.id} className="order-item-card">
                            <img
                              src={resolveOrderItemImage(item)}
                              alt={normalizeOrderItemText(item.product_name) || 'Ordered item'}
                              className="order-item-thumb"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="order-item-content">
                              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <p className="order-item-name">{normalizeOrderItemText(item.product_name)}</p>
                                  <p className="muted order-item-variant">
                                    {normalizeOrderItemText(item.variant_name) || 'Standard variant'}
                                  </p>
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
            )
          })
        )}
      </section>
    </div>
  )
}

export default OrdersPage
