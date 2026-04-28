import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import PageHeader from '../components/PageHeader.jsx'
import OrderDetailsPanel from '../components/OrderDetailsPanel.jsx'
import { 
  getAdminOrders, 
  updateAdminOrder, 
  deleteAdminOrder, 
  restoreAdminOrder, 
  forceDeleteAdminOrder,
  bulkAdminOrdersAction, 
  readResource 
} from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { Eye, RotateCcw, Archive, AlertTriangle, CheckSquare } from 'lucide-react'

const PIPELINE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']

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

function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [archivedOnly, setArchivedOnly] = useState(false)
  const [orderCounts, setOrderCounts] = useState({ active: 0, archived: 0 })
  const [countsReady, setCountsReady] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [activeTab, setActiveTab] = useState('all')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [response, activeCountResponse, allCountResponse] = await Promise.all([
        getAdminOrders({
          per_page: 100,
          with_archived: 1,
        }),
        getAdminOrders({
          per_page: 1,
          with_archived: 0,
        }),
        getAdminOrders({
          per_page: 1,
          with_archived: 1,
        }),
      ])

      const payload = readResource(response)
      const activeCountPayload = readResource(activeCountResponse)
      const allCountPayload = readResource(allCountResponse)

      setOrders(Array.isArray(payload?.data) ? payload.data : [])

      const activeCount = extractCollectionTotal(activeCountPayload)
      const allCount = extractCollectionTotal(allCountPayload)

      setOrderCounts({
        active: activeCount,
        archived: Math.max(0, allCount - activeCount),
      })
      setCountsReady(true)
    } catch {
      setError('Failed to load orders.')
      setCountsReady(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const scopedOrders = useMemo(() => {
    return orders.filter((order) => (archivedOnly ? !!order.deleted_at : !order.deleted_at))
  }, [orders, archivedOnly])

  // Filter orders by active tab
  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return scopedOrders
    return scopedOrders.filter((o) => o.status === activeTab)
  }, [scopedOrders, activeTab])

  // Count per status for tab badges
  const statusCounts = useMemo(() => {
    const counts = { all: scopedOrders.length }
    for (const s of STATUSES) {
      counts[s] = scopedOrders.filter((o) => o.status === s).length
    }
    return counts
  }, [scopedOrders])

  const selectedOrders = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    return filteredOrders.filter((order) => selectedSet.has(order.id))
  }, [filteredOrders, selectedIds])

  const selectionIncludesArchived = selectedOrders.some((order) => !!order.deleted_at)
  const selectionIncludesActive = selectedOrders.some((order) => !order.deleted_at)
  const archivedOnlySelection = selectedOrders.length > 0 && !selectionIncludesActive
  const activeOnlySelection = selectedOrders.length > 0 && !selectionIncludesArchived

  // Clear selection when tab or archive mode changes
  useEffect(() => {
    setSelectedIds([])
  }, [activeTab, archivedOnly])

  async function handleStatusChange(orderId, newStatus) {
    setUpdatingId(orderId)
    try {
      const response = await updateAdminOrder(orderId, { status: newStatus })
      const updatedOrder = readResource(response).order
      setOrders((current) => current.map((o) => (o.id === orderId ? updatedOrder : o)))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updatedOrder)
      }
    } catch {
      alert('Failed to update order status.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleArchive(id) {
    if (!window.confirm('Are you sure you want to archive this order?')) return
    try {
      await deleteAdminOrder(id)
      loadOrders()
    } catch {
      alert('Failed to archive order.')
    }
  }

  async function handleRestore(id) {
    try {
      await restoreAdminOrder(id)
      loadOrders()
    } catch {
      alert('Failed to restore order.')
    }
  }

  async function handleForceDelete(id) {
    if (!window.confirm('WARNING: THIS IS PERMANENT. Delete this order forever?')) return
    try {
      await forceDeleteAdminOrder(id)
      loadOrders()
      if (selectedOrder?.id === id) setSelectedOrder(null)
    } catch {
      alert('Failed to permanently delete order.')
    }
  }

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(filteredOrders.map(o => o.id))
    } else {
      setSelectedIds([])
    }
  }

  const toggleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(v => v !== id))
    }
  }

  async function handleBulkAction(event) {
    const action = event.target.value
    if (!action) return

    if (archivedOnly && action.startsWith('status_')) {
      alert('Status updates are available only in the active orders tab.')
      event.target.value = ''
      return
    }

    if ((action === 'restore' || action === 'force_delete') && !archivedOnlySelection) {
      alert('Select archived orders only before using restore or permanent delete.')
      event.target.value = ''
      return
    }

    if (action === 'archive' && !activeOnlySelection) {
      alert('Select active orders only before archiving.')
      event.target.value = ''
      return
    }
    
    if (action === 'force_delete') {
      if (!window.confirm('WARNING: THIS IS PERMANENT. Delete these orders forever?')) {
        event.target.value = ''
        return
      }
    }
    
    if (action === 'archive') {
      if (!window.confirm('Are you sure you want to archive these orders?')) {
        event.target.value = ''
        return
      }
    }

    setUpdatingId('bulk')
    try {
      await bulkAdminOrdersAction({ order_ids: selectedIds, action })
      setSelectedIds([])
      loadOrders()
    } catch {
      alert('Failed to execute bulk action.')
    } finally {
      setUpdatingId(null)
      event.target.value = ''
    }
  }

  return (
    <div className="page-grid admin-orders-page">
      <div className="admin-page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader
          eyebrow="Commerce"
          title="Orders"
          description="Manage the queue and fulfillment status."
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pipeline-tabs" role="tablist" aria-label="Order list view mode">
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
                {countsReady ? orderCounts.active : ''}
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
                {countsReady ? orderCounts.archived : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline Tabs */}
      {!archivedOnly && (
        <div className="pipeline-tabs">
          {PIPELINE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`pipeline-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              {statusCounts[tab.key] > 0 && (
                <span className="pipeline-tab-count">{statusCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? <div className="notice">Loading orders...</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      {!loading && !error && (
        <section className="content-card admin-table-shell" style={{ overflowX: 'auto', padding: 0 }}>
          {selectedIds.length > 0 && (
            <div className="bulk-action-bar">
              <span className="bulk-count">
                <CheckSquare size={16} /> 
                {selectedIds.length} order{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="bulk-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select className="select bulk-select" onChange={handleBulkAction} disabled={updatingId === 'bulk'} defaultValue="">
                  <option value="" disabled>{archivedOnly ? 'Choose action...' : 'Change status to...'}</option>
                  {archivedOnly ? (
                    <>
                      <option value="restore" disabled={!archivedOnlySelection}>Restore Selected</option>
                      <option value="force_delete" disabled={!archivedOnlySelection}>Permanently Delete</option>
                    </>
                  ) : (
                    <>
                      {STATUSES.map(s => (
                        <option key={`status_${s}`} value={`status_${s}`}>Mark {s}</option>
                      ))}
                      <option disabled>──────</option>
                      <option value="archive" disabled={!activeOnlySelection}>Archive Selection</option>
                    </>
                  )}
                </select>
                <button type="button" className="button secondary" onClick={() => setSelectedIds([])} disabled={updatingId === 'bulk'}>
                  Deselect
                </button>
              </div>
            </div>
          )}
          <table className="admin-data-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '14px 16px', width: '40px' }}>
                  <input 
                    type="checkbox" 
                    className="checkbox"
                    checked={filteredOrders.length > 0 && selectedIds.length === filteredOrders.length}
                    ref={input => {
                      if (input) {
                        input.indeterminate = selectedIds.length > 0 && selectedIds.length < filteredOrders.length;
                      }
                    }}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Order #</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Date</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Customer</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Total</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {archivedOnly
                      ? 'No archived orders found.'
                      : activeTab === 'all'
                        ? 'No orders found.'
                        : `No ${activeTab} orders.`}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isArchived = !!order.deleted_at
                  const isSelected = selectedIds.includes(order.id)
                  
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: isArchived ? 0.6 : 1, background: isSelected ? 'var(--color-surface-2)' : 'transparent', transition: 'background 0.15s ease' }}>
                      <td data-label="Select" style={{ padding: '14px 16px' }}>
                        <input 
                          type="checkbox" 
                          className="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectOne(order.id, e.target.checked)}
                        />
                      </td>
                      <td data-label="Order #" style={{ padding: '14px 16px', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {order.order_number}
                          {isArchived && <span className="status-pill status-archived">Archived</span>}
                        </div>
                      </td>
                      <td data-label="Date" style={{ padding: '14px 16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td data-label="Customer" style={{ padding: '14px 16px' }}>
                        {order.user?.username || order.user?.name || order.user?.email || 'Guest'}
                      </td>
                      <td data-label="Total" style={{ padding: '14px 16px', fontWeight: 500 }}>{formatMoney(order.total)}</td>
                      <td data-label="Status" style={{ padding: '14px 16px' }}>
                        <span className={`status-pill status-${order.status}`}>{order.status}</span>
                      </td>
                      <td data-label="Actions" style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div className="admin-table-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                           <button
                             type="button"
                             className="button secondary"
                             style={{ padding: '6px', minWidth: '32px' }}
                             onClick={() => setSelectedOrder(order)}
                             title="View Details"
                           >
                             <Eye size={16} />
                           </button>
                           
                           {isArchived ? (
                             <>
                               <button
                                 type="button"
                                 className="button secondary"
                                 style={{ padding: '6px', minWidth: '32px' }}
                                 onClick={() => handleRestore(order.id)}
                                 title="Restore Order"
                               >
                                 <RotateCcw size={16} />
                               </button>
                               <button
                                 type="button"
                                 className="button secondary"
                                 style={{ padding: '6px', minWidth: '32px', color: 'var(--color-error)' }}
                                 onClick={() => handleForceDelete(order.id)}
                                 title="Delete Permanently"
                               >
                                 <AlertTriangle size={16} />
                               </button>
                             </>
                           ) : (
                             <button
                               type="button"
                               className="button secondary"
                               style={{ padding: '6px', minWidth: '32px', color: 'var(--color-notice-text)' }}
                               onClick={() => handleArchive(order.id)}
                               title="Archive Order"
                             >
                               <Archive size={16} />
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

      {selectedOrder && createPortal(
        <>
          <div 
            className="admin-side-panel-overlay"
            onClick={() => setSelectedOrder(null)} 
          />
          <OrderDetailsPanel 
            order={selectedOrder} 
            onClose={() => setSelectedOrder(null)}
            onUpdateStatus={handleStatusChange}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onForceDelete={handleForceDelete}
          />
        </>,
        document.body
      )}
    </div>
  )
}

export default AdminOrdersPage
