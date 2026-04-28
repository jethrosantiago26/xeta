import { useCallback, useEffect, useState, useMemo } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import CustomerDetailsPanel from '../components/CustomerDetailsPanel.jsx'
import { 
  getAdminCustomers, 
  updateAdminCustomer, 
  deleteAdminCustomer, 
  restoreAdminCustomer, 
  forceDeleteAdminCustomer, 
  readResource 
} from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { Archive, Edit3, RotateCcw, AlertTriangle, Users, Search } from 'lucide-react'

const CUSTOMER_TABS = [
  { key: 'all', label: 'All Customers' },
  { key: 'active', label: 'Recent Active' },
  { key: 'vip', label: 'Top Spenders' },
]

function extractCollectionTotal(payload) {
  const total = Number(
    payload?.data?.meta?.total
    ?? payload?.meta?.total
    ?? payload?.data?.total
    ?? payload?.total,
  )

  if (Number.isFinite(total)) {
    return total
  }

  const rows = payload?.data?.data ?? payload?.data ?? []
  return Array.isArray(rows) ? rows.length : 0
}

function AdminCustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [archivedOnly, setArchivedOnly] = useState(false)
  const [customerCounts, setCustomerCounts] = useState({ active: 0, archived: 0 })
  const [countsReady, setCountsReady] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [response, activeCountResponse, allCountResponse] = await Promise.all([
        getAdminCustomers({ per_page: 100, with_archived: 1 }),
        getAdminCustomers({ per_page: 1, with_archived: 0 }),
        getAdminCustomers({ per_page: 1, with_archived: 1 }),
      ])

      const payload = readResource(response)
      const activeCountPayload = readResource(activeCountResponse)
      const allCountPayload = readResource(allCountResponse)

      setCustomers(Array.isArray(payload?.data) ? payload.data : [])

      const activeCount = extractCollectionTotal(activeCountPayload)
      const allCount = extractCollectionTotal(allCountPayload)

      setCustomerCounts({
        active: activeCount,
        archived: Math.max(0, allCount - activeCount),
      })
      setCountsReady(true)
    } catch {
      setError('Failed to load customers.')
      setCountsReady(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  const filteredCustomers = useMemo(() => {
    let results = customers.filter((customer) => (archivedOnly ? !!customer.deleted_at : !customer.deleted_at))

    // Tab filtering
    if (!archivedOnly) {
      if (activeTab === 'active') {
        results = results.filter(c => (c.orders_count || 0) > 0)
      } else if (activeTab === 'vip') {
        results = results.filter(c => (c.orders_sum_total || 0) > 1000)
      }
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (c.email || '').toLowerCase().includes(q) ||
        (c.username || '').toLowerCase().includes(q)
      )
    }

    return results
  }, [customers, archivedOnly, activeTab, search])

  async function handleArchive(id, isArchived) {
    if (!window.confirm(`Are you sure you want to ${isArchived ? 'restore' : 'archive'} this customer?`)) return
    try {
      if (isArchived) await restoreAdminCustomer(id)
      else await deleteAdminCustomer(id)
      loadCustomers()
    } catch {
      alert(`Failed to ${isArchived ? 'restore' : 'archive'} customer.`)
    }
  }

  async function handleForceDelete(id) {
    if (!window.confirm('WARNING: PERMANENT ACTION. Delete customer forever?')) return
    try {
      await forceDeleteAdminCustomer(id)
      loadCustomers()
    } catch {
      alert('Failed to permanently delete customer.')
    }
  }

  async function handleUpdateCustomer(formData) {
    setIsSaving(true)
    try {
      await updateAdminCustomer(selectedCustomer.id, formData)
      setSelectedCustomer(null)
      loadCustomers()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update customer')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-grid admin-customers-page">
      <div className="admin-page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader
          eyebrow="Commerce"
          title="Customers"
          description="Manage user profiles, view purchase history, and handle account status."
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pipeline-tabs" role="tablist" aria-label="Customer list view mode">
            <button
              type="button"
              role="tab"
              aria-selected={!archivedOnly}
              className={`pipeline-tab${!archivedOnly ? ' active' : ''}`}
              onClick={() => {
                setArchivedOnly(false)
                setActiveTab('all')
              }}
            >
              Active
              <span className={`pipeline-tab-count${!countsReady ? ' loading' : ''}`}>
                {countsReady ? customerCounts.active : ''}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={archivedOnly}
              className={`pipeline-tab${archivedOnly ? ' active' : ''}`}
              onClick={() => {
                setArchivedOnly(true)
                setActiveTab('all')
              }}
            >
              Archived
              <span className={`pipeline-tab-count${!countsReady ? ' loading' : ''}`}>
                {countsReady ? customerCounts.archived : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + Search row */}
      <div className="admin-toolbar-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {!archivedOnly && (
          <div className="pipeline-tabs" style={{ flex: 1, minWidth: 'auto' }}>
            {CUSTOMER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`pipeline-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            className="input"
            placeholder="Search name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>
      </div>

      {loading && <div className="notice">Loading customers...</div>}
      {error && <div className="notice error">{error}</div>}

      {!loading && !error && (
        <section className="content-card admin-table-shell" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="admin-data-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '14px 16px' }}>Customer</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 16px' }}>Joined</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Total Orders</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Total Value</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <Users size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                    <p style={{ margin: 0 }}>{search ? `No results for "${search}".` : 'No customers found.'}</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const isArchived = !!customer.deleted_at
                  const displayName = customer.name || customer.username || customer.email || 'Unnamed'
                  
                  return (
                    <tr 
                      key={customer.id} 
                      style={{ borderBottom: '1px solid var(--color-border)', opacity: isArchived ? 0.6 : 1, transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td data-label="Customer" style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="review-card-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{displayName}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{customer.email}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Status" style={{ padding: '14px 16px' }}>
                        {isArchived ? (
                          <span className="status-pill status-archived">Archived</span>
                        ) : (
                          <span className="status-pill status-delivered">Active Customer</span>
                        )}
                      </td>
                      <td data-label="Joined" style={{ padding: '14px 16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                      <td data-label="Total Orders" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>
                        {customer.orders_count || 0}
                      </td>
                      <td data-label="Total Value" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-success-text)' }}>
                        {formatMoney(customer.orders_sum_total || 0)}
                      </td>
                      <td data-label="Actions" style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div className="admin-table-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: '6px' }}
                            onClick={() => setSelectedCustomer(customer)}
                            disabled={isArchived}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: '6px', color: isArchived ? 'inherit' : 'var(--color-notice-text)' }}
                            onClick={() => handleArchive(customer.id, isArchived)}
                          >
                            {isArchived ? <RotateCcw size={15} /> : <Archive size={15} />}
                          </button>
                          {isArchived && (
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ padding: '6px', color: 'var(--color-error)' }}
                              onClick={() => handleForceDelete(customer.id)}
                            >
                              <AlertTriangle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      {selectedCustomer && (
        <CustomerDetailsPanel
          customer={selectedCustomer}
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onSave={handleUpdateCustomer}
          isSaving={isSaving}
        />
      )}
    </div>
  )
}

export default AdminCustomersPage
