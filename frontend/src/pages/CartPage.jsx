import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { formatMoney } from '../lib/format.js'

function CartPage() {
  const { items, totals, loading, updateItem, removeItem } = useCart()

  return (
    <div className="page-grid">
      <section className="content-card">
        <p className="eyebrow-inline">Cart</p>
        <h1>Your shopping cart</h1>
        <p className="muted">Review quantities before moving to checkout.</p>
      </section>

      {loading ? <div className="notice">Loading cart...</div> : null}

      <section className="grid">
        {items.length === 0 ? (
          <div className="content-card">
            <h2>Your cart is empty.</h2>
            <p className="muted">Add a product to see totals and checkout options here.</p>
            <Link className="button button-primary" to="/products">
              Browse products
            </Link>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="content-card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3>{item.product?.name}</h3>
                  <p className="muted">{item.variant?.name}</p>
                </div>
                <strong>{formatMoney(item.line_total)}</strong>
              </div>
              <div className="row" style={{ marginTop: '14px' }}>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="99"
                  value={item.quantity}
                  style={{ maxWidth: '120px' }}
                  onChange={async (event) => {
                    await updateItem(item.id, Number(event.target.value))
                  }}
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={async () => {
                    await removeItem(item.id)
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="grid cards">
        <div className="summary-card">
          <h3>Totals</h3>
          <div className="divider" />
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <strong>{formatMoney(totals.subtotal)}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Shipping</span>
              <strong>{formatMoney(totals.shipping)}</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Tax</span>
              <strong>{formatMoney(totals.tax)}</strong>
            </div>
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Total</span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
          </div>
        </div>
        <div className="summary-card">
          <h3>Next step</h3>
          <p className="muted">Proceed to checkout to place a cash on delivery order.</p>
          <Link className="button button-primary" to="/checkout">
            Checkout
          </Link>
        </div>
      </section>
    </div>
  )
}

export default CartPage