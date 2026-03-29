import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useSession } from '../context/SessionContext.jsx'
import { getOrders, readResource } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'

function OrdersPage() {
  const { isLoaded, isSignedIn, loading: sessionLoading, refreshProfile } = useSession()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadOrders() {
      if (!isLoaded || sessionLoading) {
        return
      }

      if (!isSignedIn) {
        if (active) {
          setOrders([])
          setLoading(false)
          setError('')
        }
        return
      }

      setLoading(true)
      setError('')

      try {
        await refreshProfile()
        const response = await getOrders({ per_page: 10 })
        const payload = readResource(response)
        const records = Array.isArray(payload?.data)
          ? payload.data
          : (payload?.data?.data ?? [])

        if (active) {
          setOrders(records)
        }
      } catch (requestError) {
        if (active) {
          setOrders([])
          setError(requestError?.response?.data?.message || 'Orders could not be loaded right now. Please retry.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadOrders()

    return () => {
      active = false
    }
  }, [isLoaded, isSignedIn, sessionLoading, reloadKey])

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
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3>{order.order_number}</h3>
                  <p className="muted">Placed on {new Date(order.created_at).toLocaleString()}</p>
                </div>
                <span className="status-pill">{order.status}</span>
              </div>
              <div className="divider" />
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