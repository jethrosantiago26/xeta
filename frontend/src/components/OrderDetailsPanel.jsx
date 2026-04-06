import React from 'react'
import { X, Package, Truck, CreditCard, User, Clock, CheckCircle2, Circle, XCircle } from 'lucide-react'
import { formatMoney } from '../lib/format'
import { normalizeOrderItemText, resolveOrderItemImage } from '../lib/orderItemMedia'

const ORDER_STEPS = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

function getStepState(stepKey, orderStatus) {
  if (orderStatus === 'cancelled') return 'cancelled'

  const statusIndex = ORDER_STEPS.findIndex((s) => s.key === orderStatus)
  const stepIndex = ORDER_STEPS.findIndex((s) => s.key === stepKey)

  if (stepIndex < statusIndex) return 'completed'
  if (stepIndex === statusIndex) return 'active'
  return 'upcoming'
}

function OrderDetailsPanel({ order, onClose, onUpdateStatus, onArchive, onRestore, onForceDelete }) {
  if (!order) return null

  const isArchived = !!order.deleted_at
  const isCancelled = order.status === 'cancelled'

  return (
    <div className="admin-side-panel">
      {/* Header */}
      <div className="order-detail-header">
        <div>
          <div className="order-detail-eyebrow">Order Details</div>
          <h2 className="order-detail-title">#{order.order_number}</h2>
        </div>
        <button onClick={onClose} className="admin-modal-close" aria-label="Close">
          <X size={24} />
        </button>
      </div>

      <div className="order-detail-body">
        {/* Visual Order Tracker */}
        <section className="order-detail-section">
          <div className="order-tracker-panel">
            {isCancelled ? (
              <div className="order-tracker-cancelled">
                <XCircle size={28} />
                <span>Order Cancelled</span>
              </div>
            ) : (
              <div className="order-tracker-steps">
                {ORDER_STEPS.map((step, index) => {
                  const state = getStepState(step.key, order.status)
                  const StepIcon = step.icon
                  return (
                    <React.Fragment key={step.key}>
                      <div className={`order-tracker-step order-tracker-step--${state}`}>
                        <div className="order-tracker-icon">
                          {state === 'completed' ? (
                            <CheckCircle2 size={20} />
                          ) : state === 'active' ? (
                            <StepIcon size={20} />
                          ) : (
                            <Circle size={20} />
                          )}
                        </div>
                        <span className="order-tracker-label">{step.label}</span>
                      </div>
                      {index < ORDER_STEPS.length - 1 && (
                        <div className={`order-tracker-connector ${state === 'completed' ? 'order-tracker-connector--filled' : ''}`} />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="order-detail-section">
          <div className="order-detail-section-label">Quick Actions</div>
          <div className="order-detail-actions-bar">
            <select 
              className="input order-detail-status-select"
              value={order.status}
              onChange={(e) => onUpdateStatus(order.id, e.target.value)}
              disabled={isArchived}
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            {isArchived ? (
              <>
                <button className="button button-secondary" onClick={() => onRestore(order.id)}>Restore</button>
                <button className="button button-secondary" onClick={() => onForceDelete(order.id)} style={{ color: 'var(--color-error)' }}>Delete</button>
              </>
            ) : (
              <button className="button button-secondary" onClick={() => onArchive(order.id)}>Archive</button>
            )}
          </div>
        </section>

        {/* Customer Info */}
        <section className="order-detail-section">
          <div className="order-detail-section-header">
            <User size={16} />
            <span>Customer</span>
          </div>
          <div className="order-detail-card">
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {order.user?.name || order.user?.username || 'Guest'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{order.user?.email}</div>
          </div>
        </section>

        {/* Items */}
        <section className="order-detail-section">
          <div className="order-detail-section-header">
            <Package size={16} />
            <span>Items ({order.items?.length || 0})</span>
          </div>
          <div className="order-detail-card" style={{ padding: 0, overflow: 'hidden' }}>
            {order.items?.map((item, idx) => (
              <div key={item.id} className="order-detail-item" style={{
                borderBottom: idx === order.items.length - 1 ? 'none' : '1px solid var(--color-border)'
              }}>
                <img 
                  src={resolveOrderItemImage(item)}
                  alt={normalizeOrderItemText(item.product_name) || 'Ordered item'}
                  className="order-detail-item-image"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>
                    {normalizeOrderItemText(item.product_name)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {(normalizeOrderItemText(item.variant_name) || 'Standard variant')} × {item.quantity}
                  </div>
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>{formatMoney(item.total)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Shipping */}
        {order.shipping_address && (
          <section className="order-detail-section">
            <div className="order-detail-section-header">
              <Truck size={16} />
              <span>Shipping Address</span>
            </div>
            <div className="order-detail-card">
              <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                {order.shipping_address?.line1}<br />
                {order.shipping_address?.line2 && <>{order.shipping_address.line2}<br /></>}
                {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.postal_code}<br />
                {order.shipping_address?.country}
              </div>
            </div>
          </section>
        )}

        {/* Payment & Totals */}
        <section className="order-detail-section">
          <div className="order-detail-section-header">
            <CreditCard size={16} />
            <span>Payment & Totals</span>
          </div>
          <div className="order-detail-card">
            <div className="order-detail-total-row">
              <span className="order-detail-total-label">Subtotal</span>
              <span>{formatMoney(order.subtotal)}</span>
            </div>
            <div className="order-detail-total-row">
              <span className="order-detail-total-label">Shipping</span>
              <span>{formatMoney(order.shipping)}</span>
            </div>
            <div className="order-detail-total-row order-detail-total-grand">
              <span>Total</span>
              <span>{formatMoney(order.total)}</span>
            </div>
          </div>
        </section>

        {/* Timestamps */}
        <section className="order-detail-section">
          <div className="order-detail-timestamps">
            <div>
              <span className="order-detail-total-label">Created</span>
              <span style={{ fontSize: '13px' }}>{new Date(order.created_at).toLocaleString()}</span>
            </div>
            {order.updated_at && order.updated_at !== order.created_at && (
              <div>
                <span className="order-detail-total-label">Updated</span>
                <span style={{ fontSize: '13px' }}>{new Date(order.updated_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default OrderDetailsPanel
