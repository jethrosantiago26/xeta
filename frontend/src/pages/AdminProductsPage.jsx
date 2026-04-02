import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PageHeader from '../components/PageHeader.jsx'
import ProductEditorPanel from '../components/ProductEditorPanel.jsx'
import {
  deleteAdminProduct,
  getAdminProducts,
  readResource,
  restoreAdminProduct,
  forceDeleteAdminProduct,
} from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { Plus, Pencil, RotateCcw, Trash2, AlertTriangle, Package } from 'lucide-react'

function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [withArchived, setWithArchived] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState(null)

  // Side panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getAdminProducts({
        per_page: 50,
        with_archived: withArchived ? 1 : 0,
      })
      const payload = readResource(response)
      const parsed = payload?.data?.data ?? payload?.data ?? []
      setProducts(Array.isArray(parsed) ? parsed : [])
    } catch {
      setError('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [withArchived])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  function openCreate() {
    setEditingProduct(null)
    setPanelOpen(true)
  }

  function openEdit(product) {
    setEditingProduct(product)
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    setEditingProduct(null)
  }

  async function handleArchive(productId) {
    if (!window.confirm('Archive this product?')) return
    setDeletingProductId(productId)
    setError('')
    try {
      await deleteAdminProduct(productId)
      await loadProducts()
      setSuccess('Product archived.')
    } catch {
      setError('Could not archive product.')
    } finally {
      setDeletingProductId(null)
    }
  }

  async function handleRestore(productId) {
    setError('')
    try {
      await restoreAdminProduct(productId)
      await loadProducts()
      setSuccess('Product restored.')
    } catch {
      setError('Could not restore product.')
    }
  }

  async function handlePermanentDelete(productId) {
    if (!window.confirm('WARNING: THIS IS PERMANENT. Delete forever?')) return
    setError('')
    try {
      await forceDeleteAdminProduct(productId)
      await loadProducts()
      setSuccess('Product permanently deleted.')
    } catch {
      setError('Permanent delete failed.')
    }
  }

  function getLowestPrice(product) {
    const variants = product.variants || []
    if (!variants.length) return null
    const prices = variants.map((v) => Number(v.price)).filter((p) => !isNaN(p))
    return prices.length ? Math.min(...prices) : null
  }

  function getTotalStock(product) {
    const variants = product.variants || []
    return variants.reduce((sum, v) => sum + Number(v.stock_quantity || 0), 0)
  }

  return (
    <div className="page-grid">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <PageHeader
          eyebrow="Catalog management"
          title="Product Control"
          description="Manage your product catalog, variants, and inventory."
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label className="admin-archive-toggle">
            <input
              type="checkbox"
              checked={withArchived}
              onChange={(e) => setWithArchived(e.target.checked)}
            />
            Show Archived
          </label>
          <button type="button" className="button button-primary" onClick={openCreate}>
            <Plus size={16} /> Create Product
          </button>
        </div>
      </div>

      {success && <div className="notice">{success}</div>}
      {error && <div className="notice error">{error}</div>}
      {loading && <div className="notice">Loading products...</div>}

      {!loading && !error && (
        <section className="content-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '14px 16px', width: '36px' }}>
                  <Package size={16} style={{ color: 'var(--color-text-muted)' }} />
                </th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Product</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Category</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Variants</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>From</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Stock</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <Package size={40} style={{ opacity: 0.3 }} />
                      <p style={{ margin: 0 }}>No products found. Click "Create Product" to start building your catalog.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const isArchived = !!product.deleted_at
                  const variantCount = product.variants?.length ?? 0
                  const lowestPrice = getLowestPrice(product)
                  const totalStock = getTotalStock(product)
                  const variantColors = (product.variants || [])
                    .map((v) => v.color_hex || v.attributes?.color_hex)
                    .filter(Boolean)
                    .slice(0, 4)

                  return (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        opacity: isArchived ? 0.5 : 1,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Color dots */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {variantColors.length > 0
                            ? variantColors.map((c, i) => (
                                <div
                                  key={i}
                                  style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: c,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                  }}
                                />
                              ))
                            : <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-text-muted)', opacity: 0.3 }} />
                          }
                        </div>
                      </td>

                      {/* Name + slug */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {product.name}
                          {isArchived && <span className="status-pill status-archived">Archived</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{product.slug}</div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '14px 16px' }}>
                        <span className="chip">{product.category?.name || '—'}</span>
                      </td>

                      {/* Variants count */}
                      <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                        {variantCount}
                      </td>

                      {/* Price */}
                      <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                        {lowestPrice !== null ? formatMoney(lowestPrice) : '—'}
                      </td>

                      {/* Stock */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          fontWeight: 600,
                          color: totalStock === 0 ? 'var(--color-error-text)' : totalStock < 10 ? 'var(--color-notice-text)' : 'var(--color-success-text)' 
                        }}>
                          {totalStock}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span className={`status-pill ${product.is_active ? 'success' : 'status-cancelled'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {!isArchived && (
                            <button
                              type="button"
                              className="button secondary"
                              style={{ padding: '6px', minWidth: '32px' }}
                              onClick={() => openEdit(product)}
                              title="Edit Product"
                            >
                              <Pencil size={16} />
                            </button>
                          )}

                          {isArchived ? (
                            <>
                              <button
                                type="button"
                                className="button secondary"
                                style={{ padding: '6px', minWidth: '32px' }}
                                onClick={() => handleRestore(product.id)}
                                title="Restore"
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                type="button"
                                className="button secondary"
                                style={{ padding: '6px', minWidth: '32px', color: 'var(--color-error)' }}
                                onClick={() => handlePermanentDelete(product.id)}
                                title="Delete Permanently"
                              >
                                <AlertTriangle size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="button secondary"
                              style={{ padding: '6px', minWidth: '32px', color: 'var(--color-error)' }}
                              disabled={deletingProductId === product.id}
                              onClick={() => handleArchive(product.id)}
                              title="Archive"
                            >
                              <Trash2 size={16} />
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

      {/* Side Panel Portal */}
      {panelOpen && createPortal(
        <>
          <div className="admin-side-panel-overlay" onClick={closePanel} />
          <ProductEditorPanel
            product={editingProduct}
            onClose={closePanel}
            onSaved={loadProducts}
          />
        </>,
        document.body,
      )}
    </div>
  )
}

export default AdminProductsPage