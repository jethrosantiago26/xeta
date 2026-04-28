import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import PageHeader from '../components/PageHeader.jsx'
import ProductEditorPanel from '../components/ProductEditorPanel.jsx'
import {
  deleteAdminProduct,
  deleteArchivedAdminProduct,
  getAssetUrl,
  getAdminProducts,
  readResource,
  restoreAdminProduct,
} from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { Plus, Pencil, RotateCcw, Archive, AlertTriangle, Package, SlidersHorizontal, X } from 'lucide-react'

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

function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [archivedOnly, setArchivedOnly] = useState(false)
  const [productCounts, setProductCounts] = useState({ active: 0, archived: 0 })
  const [countsReady, setCountsReady] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState(null)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  // Side panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [response, activeCountResponse, allCountResponse] = await Promise.all([
        getAdminProducts({
          per_page: 50,
          with_archived: archivedOnly ? 1 : 0,
        }),
        getAdminProducts({
          per_page: 1,
          with_archived: 0,
        }),
        getAdminProducts({
          per_page: 1,
          with_archived: 1,
        }),
      ])

      const payload = readResource(response)
      const activeCountPayload = readResource(activeCountResponse)
      const allCountPayload = readResource(allCountResponse)

      const parsed = payload?.data?.data ?? payload?.data ?? []
      const productList = Array.isArray(parsed) ? parsed : []
      setProducts(productList.filter((product) => (archivedOnly ? !!product?.deleted_at : !product?.deleted_at)))

      const activeCount = extractCollectionTotal(activeCountPayload)
      const allCount = extractCollectionTotal(allCountPayload)

      setProductCounts({
        active: activeCount,
        archived: Math.max(0, allCount - activeCount),
      })
      setCountsReady(true)
    } catch {
      setError('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [archivedOnly])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (!mobileMoreOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setMobileMoreOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [mobileMoreOpen])

  useEffect(() => {
    if (panelOpen) {
      setMobileMoreOpen(false)
    }
  }, [panelOpen])

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

      if (countsReady) {
        setProductCounts((current) => ({
          active: Math.max(0, current.active - 1),
          archived: current.archived + 1,
        }))
      }

      setProducts((current) => current.filter((product) => Number(product.id) !== Number(productId)))

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

      if (countsReady) {
        setProductCounts((current) => ({
          active: current.active + 1,
          archived: Math.max(0, current.archived - 1),
        }))
      }

      setProducts((current) => current.filter((product) => Number(product.id) !== Number(productId)))

      await loadProducts()
      setSuccess('Product restored.')
    } catch {
      setError('Could not restore product.')
    }
  }

  async function handlePermanentDelete(productId) {
    if (!window.confirm('WARNING: THIS IS PERMANENT. Delete forever?')) return
    setDeletingProductId(productId)
    setError('')
    try {
      await deleteArchivedAdminProduct(productId)

      if (countsReady) {
        setProductCounts((current) => ({
          active: current.active,
          archived: Math.max(0, current.archived - 1),
        }))
      }

      setProducts((current) => current.filter((product) => Number(product.id) !== Number(productId)))

      await loadProducts()
      setSuccess('Product permanently deleted.')
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Permanent delete failed.')
    } finally {
      setDeletingProductId(null)
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

  function resolveProductPreviewImage(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : []
    const variantWithImage = variants.find((variant) => variant?.image_url || variant?.attributes?.image_url)

    if (variantWithImage) {
      return getAssetUrl(variantWithImage.image_url || variantWithImage.attributes?.image_url)
    }

    if (product?.primary_image) {
      return getAssetUrl(product.primary_image)
    }

    const images = Array.isArray(product?.images) ? product.images : []
    const primary = images.find((image) => image?.is_primary)
    const fallback = primary?.url || images[0]?.url || ''

    return fallback ? getAssetUrl(fallback) : ''
  }

  function getStockToneClass(totalStock) {
    if (totalStock <= 0) return 'zero'
    if (totalStock < 10) return 'low'
    return 'healthy'
  }

  async function handleMobileRefresh() {
    setSuccess('')
    await loadProducts()
  }

  return (
    <div className="page-grid admin-products-page">
      <div className="admin-products-header">
        <PageHeader
          eyebrow="Catalog management"
          title="Product Control"
          description="Manage your product catalog, variants, and inventory."
        />
        <div className="admin-products-toolbar-actions">
          <div className="pipeline-tabs" role="tablist" aria-label="Product list view mode">
            <button
              type="button"
              role="tab"
              aria-selected={!archivedOnly}
              className={`pipeline-tab${!archivedOnly ? ' active' : ''}`}
              onClick={() => setArchivedOnly(false)}
            >
              Active
              <span className={`pipeline-tab-count${!countsReady ? ' loading' : ''}`}>
                {countsReady ? productCounts.active : ''}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={archivedOnly}
              className={`pipeline-tab${archivedOnly ? ' active' : ''}`}
              onClick={() => setArchivedOnly(true)}
            >
              Archived
              <span className={`pipeline-tab-count${!countsReady ? ' loading' : ''}`}>
                {countsReady ? productCounts.archived : ''}
              </span>
            </button>
          </div>
          <button type="button" className="button button-primary" onClick={openCreate}>
            <Plus size={16} /> Create Product
          </button>
        </div>
      </div>

      {success && <div className="notice">{success}</div>}
      {error && <div className="notice error">{error}</div>}
      {loading && <div className="notice">Loading products...</div>}

      {!panelOpen && (
        <div className="admin-products-mobile-bar" role="toolbar" aria-label="Quick product actions">
          <button
            type="button"
            className="admin-products-mobile-bar-button"
            onClick={openCreate}
          >
            <Plus size={15} />
            <span>Create</span>
          </button>
          <button
            type="button"
            className={`admin-products-mobile-bar-button${mobileMoreOpen ? ' active' : ''}`}
            onClick={() => setMobileMoreOpen(true)}
          >
            <SlidersHorizontal size={15} />
            <span>More</span>
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
        <section className="content-card admin-products-table-shell" style={{ overflowX: 'auto', padding: 0 }}>
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
                      <p style={{ margin: 0 }}>
                        {archivedOnly
                          ? 'No archived products found.'
                          : 'No products found. Click "Create Product" to start building your catalog.'}
                      </p>
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
                        <span className="chip">{product.category?.name || '-'}</span>
                      </td>

                      {/* Variants count */}
                      <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                        {variantCount}
                      </td>

                      {/* Price */}
                      <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                        {lowestPrice !== null ? formatMoney(lowestPrice) : '-'}
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
                                disabled={deletingProductId === product.id}
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
                              style={{ padding: '6px', minWidth: '32px', color: 'var(--color-notice-text)' }}
                              disabled={deletingProductId === product.id}
                              onClick={() => handleArchive(product.id)}
                              title="Archive"
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

        <section className="admin-products-mobile-list" aria-label="Product list">
          {products.length === 0 ? (
            <article className="admin-products-mobile-empty">
              <Package size={30} style={{ opacity: 0.35 }} />
              <p>
                {archivedOnly
                  ? 'No archived products found.'
                  : 'No products found. Create your first product to start building your catalog.'}
              </p>
            </article>
          ) : (
            products.map((product) => {
              const isArchived = !!product.deleted_at
              const variantCount = product.variants?.length ?? 0
              const lowestPrice = getLowestPrice(product)
              const totalStock = getTotalStock(product)
              const previewImage = resolveProductPreviewImage(product)

              return (
                <article
                  key={`mobile-${product.id}`}
                  className={`admin-products-mobile-card${isArchived ? ' archived' : ''}`}
                >
                  <div className="admin-products-mobile-main">
                    <div className="admin-products-mobile-media">
                      {previewImage ? (
                        <img src={previewImage} alt={product.name} className="admin-products-mobile-image" />
                      ) : (
                        <div className="admin-products-mobile-image-fallback" aria-hidden="true">
                          <Package size={20} />
                        </div>
                      )}
                    </div>

                    <div className="admin-products-mobile-copy">
                      <div className="admin-products-mobile-title-row">
                        <h3>{product.name}</h3>
                        {isArchived && <span className="status-pill status-archived">Archived</span>}
                      </div>
                      <p className="admin-products-mobile-slug">{product.slug}</p>
                      <p className="admin-products-mobile-category">{product.category?.name || 'Uncategorized'}</p>
                    </div>
                  </div>

                  <div className="admin-products-mobile-stats">
                    <div className="admin-products-mobile-stat">
                      <span>Variants</span>
                      <strong>{variantCount}</strong>
                    </div>
                    <div className="admin-products-mobile-stat">
                      <span>From</span>
                      <strong>{lowestPrice !== null ? formatMoney(lowestPrice) : '-'}</strong>
                    </div>
                    <div className="admin-products-mobile-stat">
                      <span>Stock</span>
                      <strong className={`admin-products-mobile-stock ${getStockToneClass(totalStock)}`}>{totalStock}</strong>
                    </div>
                    <div className="admin-products-mobile-stat">
                      <span>Status</span>
                      <span className={`status-pill ${product.is_active ? 'success' : 'status-cancelled'}`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="admin-products-mobile-actions">
                    {!isArchived && (
                      <button
                        type="button"
                        className="button button-secondary admin-products-mobile-action"
                        onClick={() => openEdit(product)}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    )}

                    {isArchived ? (
                      <>
                        <button
                          type="button"
                          className="button button-secondary admin-products-mobile-action"
                          onClick={() => handleRestore(product.id)}
                        >
                          <RotateCcw size={14} /> Restore
                        </button>
                        <button
                          type="button"
                          className="button button-secondary admin-products-mobile-action admin-products-mobile-action-danger"
                          disabled={deletingProductId === product.id}
                          onClick={() => handlePermanentDelete(product.id)}
                        >
                          <AlertTriangle size={14} /> Delete Forever
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary admin-products-mobile-action"
                        disabled={deletingProductId === product.id}
                        onClick={() => handleArchive(product.id)}
                      >
                        <Archive size={14} /> Archive
                      </button>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </section>
        </>
      )}

      {mobileMoreOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="admin-products-mobile-more-backdrop open"
            onClick={() => setMobileMoreOpen(false)}
            aria-hidden="false"
          >
            <section
              className="admin-products-mobile-more-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Product quick actions"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="admin-products-mobile-more-head">
                <h2>Quick Actions</h2>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <X size={14} /> Close
                </button>
              </header>

              <div className="admin-products-mobile-more-body">
                <button
                  type="button"
                  className={`admin-products-mobile-more-action${!archivedOnly ? ' active' : ''}`}
                  onClick={() => {
                    setArchivedOnly(false)
                    setMobileMoreOpen(false)
                  }}
                >
                  <Package size={16} />
                  <span>{`Show active products (${countsReady ? productCounts.active : '...'})`}</span>
                </button>

                <button
                  type="button"
                  className={`admin-products-mobile-more-action${archivedOnly ? ' active' : ''}`}
                  onClick={() => {
                    setArchivedOnly(true)
                    setMobileMoreOpen(false)
                  }}
                >
                  <Package size={16} />
                  <span>{`Show archived products (${countsReady ? productCounts.archived : '...'})`}</span>
                </button>

                <button
                  type="button"
                  className="admin-products-mobile-more-action"
                  onClick={async () => {
                    await handleMobileRefresh()
                    setMobileMoreOpen(false)
                  }}
                >
                  <RotateCcw size={16} />
                  <span>Refresh product list</span>
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
        : null}

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