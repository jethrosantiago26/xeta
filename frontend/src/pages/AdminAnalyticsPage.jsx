import { createElement, useCallback, useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { getAdminAnalytics, readResource } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { ShoppingBag, Users, Package, TrendingUp, BarChart2, AlertTriangle } from 'lucide-react'

const DAY_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]

const STATUS_COLORS = {
  pending: 'var(--color-notice-text)',
  processing: '#7b9eff',
  shipped: '#7b9eff',
  delivered: 'var(--color-success-text)',
  cancelled: 'var(--color-error-text)',
}

const analyticsInFlight = new Map()
const analyticsCache = new Map()

async function loadAnalyticsSnapshot(days) {
  const cacheKey = String(days)

  if (analyticsCache.has(cacheKey)) {
    return analyticsCache.get(cacheKey)
  }

  if (analyticsInFlight.has(cacheKey)) {
    return analyticsInFlight.get(cacheKey)
  }

  const request = getAdminAnalytics({ days })
    .then((response) => readResource(response))
    .then((payload) => {
      analyticsCache.set(cacheKey, payload)
      return payload
    })
    .finally(() => {
      analyticsInFlight.delete(cacheKey)
    })

  analyticsInFlight.set(cacheKey, request)

  return request
}

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div className="dashboard-kpi-card">
      <div className="dashboard-kpi-icon" style={accent ? { background: `${accent}20`, color: accent, borderColor: `${accent}40` } : {}}>
        {icon ? createElement(icon, { size: 20 }) : null}
      </div>
      <div className="dashboard-kpi-body">
        <div className="dashboard-kpi-value">{value}</div>
        <div className="dashboard-kpi-label">{label}</div>
        {sub && <div className="dashboard-kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(30)

  const loadAnalytics = useCallback(async (selectedDays) => {
    setLoading(true)
    setError('')
    try {
      const payload = await loadAnalyticsSnapshot(selectedDays)
      setAnalytics(payload)
    } catch {
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAnalytics(days) }, [loadAnalytics, days])

  const totalOrders = analytics?.summary?.total_orders ?? 0
  const totalRevenue = analytics?.summary?.total_revenue ?? 0
  const statusBreakdown = analytics?.status_breakdown ?? {}
  const topProducts = analytics?.top_products ?? []
  const stats = analytics?.stats ?? {}

  return (
    <div className="page-grid admin-page-grid">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <PageHeader
          eyebrow="Administration"
          title="Dashboard"
          description="Business overview, sales metrics, and fulfillment health."
        />
        <div className="pipeline-tabs" style={{ alignSelf: 'flex-end', marginBottom: '0' }}>
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`pipeline-tab ${days === opt.value ? 'active' : ''}`}
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="notice">Loading dashboard...</div>}
      {error && <div className="notice error">{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* All-time KPIs */}
          <section>
            <h2 className="dashboard-section-label">
              <span>All-Time Overview</span>
            </h2>
            <div className="dashboard-kpi-grid">
              <KpiCard
                icon={ShoppingBag}
                label="Total Orders"
                value={stats.total_orders ?? 0}
                accent="var(--color-accent)"
              />
              <KpiCard
                icon={TrendingUp}
                label="All-Time Revenue"
                value={formatMoney(stats.revenue_total ?? 0)}
                accent="var(--color-success-text)"
              />
              <KpiCard
                icon={Users}
                label="Customers"
                value={stats.total_users ?? 0}
                accent="#7b9eff"
              />
              <KpiCard
                icon={Package}
                label="Products"
                value={stats.total_products ?? 0}
                accent="var(--color-notice-text)"
              />
            </div>
          </section>

          {/* Period KPIs */}
          <section>
            <h2 className="dashboard-section-label">
              <span>Period Summary — {DAY_OPTIONS.find((o) => o.value === days)?.label}</span>
            </h2>
            <div className="dashboard-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <KpiCard
                icon={TrendingUp}
                label="Revenue"
                value={formatMoney(totalRevenue)}
                accent="var(--color-success-text)"
              />
              <KpiCard
                icon={ShoppingBag}
                label="Orders"
                value={totalOrders}
                accent="var(--color-accent)"
              />
              {totalOrders > 0 && (
                <KpiCard
                  icon={BarChart2}
                  label="Avg. Order Value"
                  value={formatMoney(totalRevenue / totalOrders)}
                  accent="#7b9eff"
                />
              )}
            </div>
          </section>

          {/* Content grid */}
          <div className="dashboard-content-grid">
            {/* Top Products */}
            <section className="content-card dashboard-section-card">
              <div className="dashboard-card-header">
                <ShoppingBag size={16} />
                <h3>Top Products</h3>
                <span className="dashboard-card-period">{DAY_OPTIONS.find((o) => o.value === days)?.label}</span>
              </div>
              {topProducts.length === 0 ? (
                <p className="muted" style={{ padding: '24px 0' }}>No sales data for this period.</p>
              ) : (
                <div className="dashboard-product-list">
                  {topProducts.map((item, index) => (
                    <div key={index} className="dashboard-product-row">
                      <div className="dashboard-product-rank">#{index + 1}</div>
                      <div className="dashboard-product-info">
                        <div className="dashboard-product-name">{item.name}</div>
                        <div className="dashboard-product-qty">{item.quantity} sold</div>
                      </div>
                      <div className="dashboard-product-revenue">{formatMoney(item.revenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Fulfillment Status */}
            <section className="content-card dashboard-section-card">
              <div className="dashboard-card-header">
                <BarChart2 size={16} />
                <h3>Fulfillment Status</h3>
                <span className="dashboard-card-period">{DAY_OPTIONS.find((o) => o.value === days)?.label}</span>
              </div>
              {Object.keys(statusBreakdown).length === 0 ? (
                <p className="muted" style={{ padding: '24px 0' }}>No orders in this period.</p>
              ) : (
                <div className="dashboard-status-list">
                  {Object.entries(statusBreakdown).map(([status, count]) => {
                    const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
                    return (
                      <div key={status} className="dashboard-status-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span
                            className={`status-pill status-${status}`}
                            style={{ textTransform: 'capitalize' }}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="dashboard-status-bar-wrap">
                          <div
                            className="dashboard-status-bar"
                            style={{
                              width: `${pct}%`,
                              background: STATUS_COLORS[status] ?? 'var(--color-text-muted)',
                            }}
                          />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '14px', minWidth: '36px', textAlign: 'right' }}>
                          {count}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Cancelled warning */}
              {(statusBreakdown.cancelled ?? 0) > 3 && (
                <div className="dashboard-warning">
                  <AlertTriangle size={14} />
                  High cancellation rate detected — {statusBreakdown.cancelled} cancelled orders.
                </div>
              )}
            </section>
          </div>

        </div>
      )}
    </div>
  )
}

export default AdminAnalyticsPage
