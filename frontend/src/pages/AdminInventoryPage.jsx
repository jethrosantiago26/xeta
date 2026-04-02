import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { getAdminInventory, updateAdminInventoryStock, readResource } from '../lib/api.js'
import { AlertTriangle, Package, TrendingDown, CheckCircle2 } from 'lucide-react'

const STOCK_TABS = [
  { key: 'all', label: 'All Items' },
  { key: 'critical', label: 'Out of Stock' },
  { key: 'low', label: 'Low Stock' },
  { key: 'healthy', label: 'In Stock' },
]

function getStockStatus(qty) {
  if (qty === 0) return 'critical'
  if (qty <= 5) return 'low'
  return 'healthy'
}

function AdminInventoryPage() {
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [stockInputs, setStockInputs] = useState({})
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getAdminInventory({ per_page: 200 })
      const payload = readResource(response)
      const data = Array.isArray(payload?.data) ? payload.data : []
      setVariants(data)
      const initialInputs = {}
      data.forEach((v) => { initialInputs[v.id] = v.stock_quantity })
      setStockInputs(initialInputs)
    } catch {
      setError('Failed to load inventory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInventory() }, [loadInventory])

  const filteredVariants = useMemo(() => {
    let results = [...variants]

    // Tab filter
    if (activeTab !== 'all') {
      results = results.filter((v) => getStockStatus(v.stock_quantity) === activeTab)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(
        (v) =>
          v.product?.name?.toLowerCase().includes(q) ||
          v.name?.toLowerCase().includes(q) ||
          v.sku?.toLowerCase().includes(q)
      )
    }

    // Sort: critical first, then low, then healthy
    const order = { critical: 0, low: 1, healthy: 2 }
    results.sort((a, b) => order[getStockStatus(a.stock_quantity)] - order[getStockStatus(b.stock_quantity)])

    return results
  }, [variants, activeTab, search])

  const tabCounts = useMemo(() => ({
    all: variants.length,
    critical: variants.filter((v) => getStockStatus(v.stock_quantity) === 'critical').length,
    low: variants.filter((v) => getStockStatus(v.stock_quantity) === 'low').length,
    healthy: variants.filter((v) => getStockStatus(v.stock_quantity) === 'healthy').length,
  }), [variants])

  function handleStockChange(id, value) {
    setStockInputs((prev) => ({ ...prev, [id]: value }))
  }

  async function handleSaveStock(variantId) {
    const newStock = parseInt(stockInputs[variantId], 10)
    if (isNaN(newStock) || newStock < 0) {
      alert('Invalid stock quantity.')
      return
    }
    setUpdatingId(variantId)
    try {
      const response = await updateAdminInventoryStock(variantId, { stock_quantity: newStock })
      const updatedVariant = readResource(response).variant
      setVariants((current) => current.map((v) => v.id === variantId ? updatedVariant : v))
      setStockInputs((prev) => ({ ...prev, [variantId]: updatedVariant.stock_quantity }))
    } catch {
      alert('Failed to update stock.')
    } finally {
      setUpdatingId(null)
    }
  }

  const criticalCount = tabCounts.critical
  const lowCount = tabCounts.low

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Monitor stock levels and update quantities across all variants."
      />

      {/* Alert banners */}
      {!loading && criticalCount > 0 && (
        <div className="inventory-alert inventory-alert--critical">
          <AlertTriangle size={18} />
          <strong>{criticalCount} variant{criticalCount !== 1 ? 's' : ''} out of stock</strong>
          — immediate restock required.
          <button type="button" className="inventory-alert-action" onClick={() => setActiveTab('critical')}>
            View →
          </button>
        </div>
      )}
      {!loading && lowCount > 0 && criticalCount === 0 && (
        <div className="inventory-alert inventory-alert--warning">
          <TrendingDown size={18} />
          <strong>{lowCount} variant{lowCount !== 1 ? 's' : ''} running low</strong>
          — consider restocking soon.
          <button type="button" className="inventory-alert-action" onClick={() => setActiveTab('low')}>
            View →
          </button>
        </div>
      )}

      {/* Tabs + Search row */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="pipeline-tabs" style={{ flex: 1, minWidth: 'auto' }}>
          {STOCK_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`pipeline-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.key === 'critical' && <AlertTriangle size={13} style={{ color: 'var(--color-error-text)' }} />}
              {tab.key === 'low' && <TrendingDown size={13} style={{ color: 'var(--color-notice-text)' }} />}
              {tab.key === 'healthy' && <CheckCircle2 size={13} style={{ color: 'var(--color-success-text)' }} />}
              <span>{tab.label}</span>
              <span className="pipeline-tab-count">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Search by product, variant, or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '280px' }}
        />
      </div>

      {loading && <div className="notice">Loading inventory...</div>}
      {error && <div className="notice error">{error}</div>}

      {!loading && !error && (
        <section className="content-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '14px 16px', width: '12px' }} />
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Product</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Variant / SKU</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Qty</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Update</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Save</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <Package size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                    <p style={{ margin: 0 }}>
                      {search ? `No results for "${search}".` : 'No inventory items found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVariants.map((variant) => {
                  const status = getStockStatus(variant.stock_quantity)
                  const isDirty = String(stockInputs[variant.id]) !== String(variant.stock_quantity)
                  const colorDot = variant.color_hex || variant.attributes?.color_hex

                  return (
                    <tr
                      key={variant.id}
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Color dot */}
                      <td style={{ padding: '14px 8px 14px 16px' }}>
                        {colorDot ? (
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colorDot, border: '1px solid rgba(255,255,255,0.2)' }} />
                        ) : (
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-text-muted)', opacity: 0.3 }} />
                        )}
                      </td>

                      {/* Product */}
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {variant.product?.name ?? '—'}
                      </td>

                      {/* Variant + SKU */}
                      <td style={{ padding: '14px 16px' }}>
                        <div>{variant.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>{variant.sku}</div>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '14px 16px' }}>
                        {status === 'critical' && (
                          <span className="status-pill status-cancelled">Out of Stock</span>
                        )}
                        {status === 'low' && (
                          <span className="status-pill warning">Low Stock</span>
                        )}
                        {status === 'healthy' && (
                          <span className="status-pill status-delivered">In Stock</span>
                        )}
                      </td>

                      {/* Current qty */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          fontSize: '18px',
                          fontWeight: 700,
                          color: status === 'critical'
                            ? 'var(--color-error-text)'
                            : status === 'low'
                              ? 'var(--color-notice-text)'
                              : 'var(--color-success-text)',
                        }}>
                          {variant.stock_quantity}
                        </span>
                      </td>

                      {/* Input */}
                      <td style={{ padding: '14px 16px' }}>
                        <input
                          type="number"
                          className="input"
                          min="0"
                          style={{ width: '80px', padding: '6px 10px', fontSize: '13px' }}
                          value={stockInputs[variant.id] ?? ''}
                          onChange={(e) => handleStockChange(variant.id, e.target.value)}
                          disabled={updatingId === variant.id}
                        />
                      </td>

                      {/* Save */}
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          type="button"
                          className="button button-primary"
                          style={{ padding: '6px 16px', fontSize: '12px', opacity: isDirty ? 1 : 0.4 }}
                          disabled={!isDirty || updatingId === variant.id}
                          onClick={() => handleSaveStock(variant.id)}
                        >
                          {updatingId === variant.id ? '...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

export default AdminInventoryPage
