import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { getAdminDashboard, readResource } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'

function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const response = await getAdminDashboard()
        const payload = readResource(response)

        if (active) {
          setDashboard(payload)
        }
      } catch {
        if (active) {
          setDashboard(null)
          setError('Dashboard data could not be loaded. Please verify your admin session and API server.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const stats = dashboard?.stats ?? {}
  const productsCount = stats.total_products ?? stats.products ?? 0
  const ordersCount = stats.total_orders ?? stats.orders ?? 0
  const usersCount = stats.total_users ?? stats.users ?? stats.total_customers ?? 0
  const revenue = stats.revenue_total ?? stats.revenue ?? 0

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Administration"
        title="Admin Overview"
        description="Operational visibility for catalog, orders, users, and revenue."
      />

      <section className="grid cards">
        <div className="stat-card">
          <h3>{loading ? '...' : productsCount}</h3>
          <p className="muted">Products</p>
        </div>
        <div className="stat-card">
          <h3>{loading ? '...' : ordersCount}</h3>
          <p className="muted">Orders</p>
        </div>
        <div className="stat-card">
          <h3>{loading ? '...' : usersCount}</h3>
          <p className="muted">Users</p>
        </div>
        <div className="stat-card">
          <h3>{loading ? '...' : formatMoney(revenue)}</h3>
          <p className="muted">Revenue</p>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
    </div>
  )
}

export default AdminDashboardPage