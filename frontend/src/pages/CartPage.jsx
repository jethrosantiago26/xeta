import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { formatMoney } from '../lib/format.js'

function getCartItemImage(item) {
  return item?.variant?.image_url || item?.product?.image || '/vite.svg'
}

function CartPage() {
  const { items, totals, loading, updateItem, removeItem } = useCart()
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="page-grid">
      <section className="content-card">
        <p className="eyebrow-inline">Cart</p>
        <h1>Your shopping cart</h1>
        <p className="muted">
          {items.length === 0
            ? 'Your cart is empty.'
            : `${itemCount} item${itemCount === 1 ? '' : 's'} ready for checkout.`}
        </p>
      </section>

      {loading ? <div className="notice">Loading cart...</div> : null}

      {items.length === 0 ? (
        <section className="cart-empty-card">
          <div className="cart-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <h2>Nothing here yet</h2>
          <p className="muted">Browse our collection and add items you love.</p>
          <Link className="button button-primary" to="/products">
            Browse products
          </Link>
        </section>
      ) : (
        <section className="cart-layout">
          {/* ── Cart Items ── */}
          <div className="cart-items-column">
            {items.map((item) => {
              const image = getCartItemImage(item)
              const colorHex = item?.variant?.color_hex

              return (
                <article key={item.id} className="cart-item-card">
                  <div className="cart-item-image-wrap">
                    <img
                      src={image}
                      alt={item.product?.name || 'Product'}
                      className="cart-item-image"
                      loading="lazy"
                      decoding="async"
                    />
                    {colorHex && (
                      <span
                        className="cart-item-color-dot"
                        style={{ background: colorHex }}
                        title={item.variant?.attributes?.color || 'Color'}
                      />
                    )}
                  </div>

                  <div className="cart-item-body">
                    <div className="cart-item-info">
                      <div className="cart-item-details">
                        <Link className="cart-item-product-name" to={`/products/${item.product?.slug}`}>
                          {item.product?.name}
                        </Link>
                        <span className="cart-item-variant-name">{item.variant?.name}</span>
                        <span className="cart-item-unit-price">{formatMoney(item.variant?.price)} each</span>
                      </div>
                      <strong className="cart-item-line-total">{formatMoney(item.line_total)}</strong>
                    </div>

                    <div className="cart-item-actions">
                      <div className="cart-qty-stepper">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          disabled={item.quantity <= 1}
                          onClick={async () => {
                            if (item.quantity > 1) {
                              await updateItem(item.id, item.quantity - 1)
                            }
                          }}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="cart-qty-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-qty-btn"
                          disabled={item.quantity >= 99}
                          onClick={async () => {
                            await updateItem(item.id, item.quantity + 1)
                          }}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="cart-remove-btn"
                        onClick={async () => {
                          await removeItem(item.id)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {/* ── Order Summary Sidebar ── */}
          <div className="cart-summary-column">
            <div className="cart-summary-card">
              <h3 className="cart-summary-title">Order summary</h3>
              <div className="cart-summary-rows">
                <div className="cart-summary-row">
                  <span>Subtotal</span>
                  <span>{formatMoney(totals.subtotal)}</span>
                </div>
                <div className="cart-summary-row">
                  <span>Shipping</span>
                  <span>{totals.shipping === 0 ? 'Free' : formatMoney(totals.shipping)}</span>
                </div>
                <div className="cart-summary-divider" />
                <div className="cart-summary-row cart-summary-total">
                  <span>Total</span>
                  <strong>{formatMoney(totals.total)}</strong>
                </div>
              </div>
              <Link className="button button-primary cart-checkout-btn" to="/checkout">
                Proceed to checkout
              </Link>
              <Link className="cart-continue-link" to="/products">
                ← Continue shopping
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default CartPage