import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { normalizeDisplayText, resolveProductImage } from '../lib/orderItemMedia.js'
import {
  createAdminPromotion,
  deleteAdminPromotion,
  getAdminProducts,
  getAdminPromotions,
  readResource,
  setAdminPromotionActive,
  updateAdminPromotion,
} from '../lib/api.js'

const PRODUCT_THUMB_FALLBACK = '/vite.svg'

const INITIAL_FORM = {
  name: '',
  description: '',
  discount_type: 'percentage',
  value: '',
  starts_at: '',
  ends_at: '',
  selected_product_ids: [],
  variant_ids: [],
  is_active: true,
}

function toOptionalNumber(value) {
  if (value === '' || value == null) {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function toDateTimeInput(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (token) => String(token).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIsoDateTime(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function summarizePromotion(promotion) {
  const discountType = String(promotion.discount_type || '')
  const value = Number(promotion.value ?? 0)

  if (discountType === 'percentage') {
    return `${value}% off`
  }

  if (discountType === 'fixed') {
    return `Fixed ${value} off`
  }

  return discountType
}

function statusTone(status) {
  if (status === 'active') return 'success'
  if (status === 'scheduled') return 'warning'
  if (status === 'expired') return 'status-cancelled'
  return 'status-archived'
}

function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)

  const isEditing = editingId !== null

  const productsById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]))
  }, [products])

  const variantsById = useMemo(() => {
    const map = new Map()

    products.forEach((product) => {
      product.variants.forEach((variant) => {
        map.set(variant.id, {
          ...variant,
          product_id: product.id,
          product_name: product.name,
          product,
        })
      })
    })

    return map
  }, [products])

  const summary = useMemo(() => {
    const now = Date.now()
    const threeDaysFromNow = now + (3 * 24 * 60 * 60 * 1000)

    let activePromotions = 0
    let scheduledPromotions = 0
    let expiringSoon = 0

    promotions.forEach((promotion) => {
      if (promotion.status === 'active') {
        activePromotions += 1

        if (promotion.ends_at) {
          const endTime = Date.parse(promotion.ends_at)

          if (!Number.isNaN(endTime) && endTime >= now && endTime <= threeDaysFromNow) {
            expiringSoon += 1
          }
        }
      }

      if (promotion.status === 'scheduled') {
        scheduledPromotions += 1
      }
    })

    return {
      active_promotions: activePromotions,
      scheduled_promotions: scheduledPromotions,
      expiring_soon: expiringSoon,
    }
  }, [promotions])

  const loadPromotions = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [promotionsResponse, productsResponse] = await Promise.all([
        getAdminPromotions({ per_page: 100, active_only: activeOnly ? 1 : 0 }),
        getAdminProducts({ per_page: 200 }),
      ])

      const promotionsPayload = readResource(promotionsResponse)
      const productsPayload = readResource(productsResponse)

      const promotionRows = promotionsPayload?.data?.data ?? promotionsPayload?.data ?? []
      const productRows = productsPayload?.data?.data ?? productsPayload?.data ?? []

      const normalizedPromotions = Array.isArray(promotionRows)
        ? promotionRows.filter((promotion) => promotion.scope === 'product')
        : []

      const normalizedProducts = Array.isArray(productRows)
        ? productRows
            .map((product) => ({
              id: Number(product.id),
              name: normalizeDisplayText(product.name) || `Product #${product.id}`,
              is_active: Boolean(product.is_active),
              primary_image: product.primary_image ?? null,
              image_url: product.image_url ?? null,
              images: Array.isArray(product.images) ? product.images : [],
              variants: Array.isArray(product.variants)
                ? product.variants
                    .map((variant) => ({
                      id: Number(variant.id),
                      name: normalizeDisplayText(variant.name) || `Variant #${variant.id}`,
                      is_active: variant.is_active !== false,
                      image_url: variant.image_url ?? null,
                      attributes: variant.attributes && typeof variant.attributes === 'object'
                        ? variant.attributes
                        : {},
                    }))
                    .filter((variant) => Number.isInteger(variant.id) && variant.id > 0)
                : [],
            }))
            .filter((product) => Number.isInteger(product.id) && product.id > 0)
        : []

      setPromotions(normalizedPromotions)
      setProducts(normalizedProducts)
    } catch {
      setError('Failed to load product sales.')
      setPromotions([])
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    loadPromotions()
  }, [loadPromotions])

  const promotionCountLabel = useMemo(() => {
    const count = promotions.length
    return `${count} sale${count === 1 ? '' : 's'}`
  }, [promotions.length])

  function resetForm() {
    setEditingId(null)
    setForm(INITIAL_FORM)
  }

  function getVariantIdsFromPromotion(promotion) {
    return Array.isArray(promotion?.conditions?.variant_ids)
      ? promotion.conditions.variant_ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      : []
  }

  function startEdit(promotion) {
    const storedVariantIds = getVariantIdsFromPromotion(promotion)

    const fallbackVariantIds = Array.isArray(promotion.product_ids)
      ? promotion.product_ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
          .flatMap((productId) => (productsById.get(productId)?.variants ?? []).map((variant) => variant.id))
      : []

    const variantIds = Array.from(new Set((storedVariantIds.length ? storedVariantIds : fallbackVariantIds)))
    const selectedProductIds = variantIds
      .map((variantId) => variantsById.get(variantId)?.product_id)
      .filter((id) => Number.isInteger(id) && id > 0)

    setEditingId(promotion.id)
    setForm({
      name: promotion.name ?? '',
      description: promotion.description ?? '',
      discount_type: promotion.discount_type ?? 'percentage',
      value: promotion.value ?? '',
      starts_at: toDateTimeInput(promotion.starts_at),
      ends_at: toDateTimeInput(promotion.ends_at),
      selected_product_ids: Array.from(new Set(
        selectedProductIds.length
          ? selectedProductIds
          : (Array.isArray(promotion.product_ids)
              ? promotion.product_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
              : []),
      )),
      variant_ids: variantIds,
      is_active: Boolean(promotion.is_active),
    })
  }

  function buildPayload() {
    const variantIds = Array.from(new Set(
      form.variant_ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ))

    const productIds = Array.from(new Set(
      variantIds
        .map((variantId) => variantsById.get(variantId)?.product_id)
        .filter((id) => Number.isInteger(id) && id > 0),
    ))

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      scope: 'product',
      value: toOptionalNumber(form.value),
      priority: 100,
      starts_at: toIsoDateTime(form.starts_at),
      ends_at: toIsoDateTime(form.ends_at),
      is_active: Boolean(form.is_active),
      product_ids: productIds,
      category_ids: [],
      conditions: {
        variant_ids: variantIds,
      },
    }

    return payload
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = buildPayload()

      if (isEditing) {
        await updateAdminPromotion(editingId, payload)
        setSuccess('Sale updated.')
      } else {
        await createAdminPromotion(payload)
        setSuccess('Sale created.')
      }

      resetForm()
      await loadPromotions()
    } catch (requestError) {
      const message = requestError?.response?.data?.message
        || Object.values(requestError?.response?.data?.errors ?? {})?.[0]?.[0]
        || 'Could not save sale.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(promotionId) {
    if (!window.confirm('Delete this sale?')) {
      return
    }

    setError('')
    setSuccess('')

    try {
      await deleteAdminPromotion(promotionId)
      setSuccess('Sale deleted.')

      if (editingId === promotionId) {
        resetForm()
      }

      await loadPromotions()
    } catch {
      setError('Failed to delete sale.')
    }
  }

  async function handleToggle(promotion) {
    setError('')
    setSuccess('')

    try {
      await setAdminPromotionActive(promotion.id, !promotion.is_active)
      setSuccess(!promotion.is_active ? 'Sale enabled.' : 'Sale disabled.')
      await loadPromotions()
    } catch {
      setError('Failed to update sale status.')
    }
  }

  function handleSelectedProductsChange(event) {
    const selectedProductIds = Array.from(event.target.selectedOptions)
      .map((option) => Number(option.value))
      .filter((id) => Number.isInteger(id) && id > 0)

    const allowedVariantIds = new Set(
      selectedProductIds.flatMap((productId) => (productsById.get(productId)?.variants ?? []).map((variant) => variant.id)),
    )

    setForm((previous) => ({
      ...previous,
      selected_product_ids: selectedProductIds,
      variant_ids: previous.variant_ids.filter((variantId) => allowedVariantIds.has(variantId)),
    }))
  }

  function handleVariantToggle(variantId, checked) {
    const safeVariantId = Number(variantId)

    if (!Number.isInteger(safeVariantId) || safeVariantId <= 0) {
      return
    }

    setForm((previous) => {
      const nextVariantIds = checked
        ? Array.from(new Set([...previous.variant_ids, safeVariantId]))
        : previous.variant_ids.filter((id) => id !== safeVariantId)

      return {
        ...previous,
        variant_ids: nextVariantIds,
      }
    })
  }

  function getTargetVariants(promotion) {
    const explicitVariantIds = getVariantIdsFromPromotion(promotion)

    const fallbackVariantIds = Array.isArray(promotion.product_ids)
      ? promotion.product_ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
          .flatMap((productId) => (productsById.get(productId)?.variants ?? []).map((variant) => variant.id))
      : []

    const effectiveVariantIds = explicitVariantIds.length ? explicitVariantIds : fallbackVariantIds

    return effectiveVariantIds
      .map((variantId) => variantsById.get(Number(variantId)) ?? null)
      .filter(Boolean)
      .map((variantRecord) => ({
        id: variantRecord.id,
        name: `${variantRecord.product_name} - ${variantRecord.name}`,
        image: resolveProductImage(variantRecord.product, {
          variant: variantRecord,
          fallbackImage: PRODUCT_THUMB_FALLBACK,
        }),
      }))
  }

  const formIsValid = form.name.trim() !== ''
    && Number(form.value) > 0
    && form.variant_ids.length > 0

  const filteredVariantOptions = useMemo(() => {
    const selectedProductIds = Array.isArray(form.selected_product_ids) ? form.selected_product_ids : []

    if (!selectedProductIds.length) {
      return []
    }

    return selectedProductIds
      .flatMap((productId) => {
        const product = productsById.get(Number(productId))

        if (!product) {
          return []
        }

        return product.variants
          .filter((variant) => variant.is_active)
          .map((variant) => ({
            id: variant.id,
            name: variant.name,
            product_name: product.name,
            product,
            variant,
            image: resolveProductImage(product, {
              variant,
              fallbackImage: PRODUCT_THUMB_FALLBACK,
            }),
          }))
      })
      .filter((variantOption) => Number.isInteger(variantOption.id) && variantOption.id > 0)
  }, [form.selected_product_ids, productsById])

  return (
    <div className="page-grid admin-page-grid">
      <PageHeader
        eyebrow="Campaigns"
        title="Variant Sales"
        description="Create sale discounts for specific variants from products in your catalog."
      />

      <section className="grid cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <article className="summary-card">
          <p className="muted" style={{ margin: 0 }}>Active sales</p>
          <h3 style={{ margin: 0 }}>{summary.active_promotions}</h3>
        </article>
        <article className="summary-card">
          <p className="muted" style={{ margin: 0 }}>Scheduled sales</p>
          <h3 style={{ margin: 0 }}>{summary.scheduled_promotions}</h3>
        </article>
        <article className="summary-card">
          <p className="muted" style={{ margin: 0 }}>Expiring in 3 days</p>
          <h3 style={{ margin: 0 }}>{summary.expiring_soon}</h3>
        </article>
      </section>

      {success ? <div className="notice success">{success}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="content-card admin-table-shell">
        <div className="toolbar" style={{ marginBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0 }}>{isEditing ? 'Edit Sale' : 'Create Sale'}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Choose products, then select exactly which variants should be on sale.</p>
          </div>
          {isEditing ? (
            <button type="button" className="button button-secondary" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
          <div className="field-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <label>
              <span className="caption">Name</span>
              <input className="input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
            </label>
          </div>

          <label>
            <span className="caption">Description</span>
            <textarea className="textarea" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={2} />
          </label>

          <div className="field-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label>
              <span className="caption">Discount type</span>
              <select className="select" value={form.discount_type} onChange={(event) => setForm((prev) => ({ ...prev, discount_type: event.target.value }))}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>
            <label>
              <span className="caption">Value</span>
              <input className="input" type="number" min="0" step="0.01" value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} placeholder={form.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 150'} />
            </label>
            <label>
              <span className="caption">Products (pick first)</span>
              <select
                className="select"
                multiple
                size={6}
                value={form.selected_product_ids.map(String)}
                onChange={handleSelectedProductsChange}
                style={{ minHeight: '148px' }}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <span className="caption" style={{ marginTop: '6px', display: 'block' }}>
                Hold Ctrl (Windows) or Command (Mac) to select multiple products.
              </span>
            </label>
          </div>

          <div className="stack" style={{ gap: '8px' }}>
            <span className="caption">Variants on sale</span>
            {!form.selected_product_ids.length ? (
              <div className="muted" style={{ fontSize: '12px' }}>
                Select one or more products first, then choose the variants.
              </div>
            ) : (
              <div className="sales-variant-grid">
                {filteredVariantOptions.map((variantOption) => {
                  const isSelected = form.variant_ids.includes(variantOption.id)

                  return (
                    <label
                      key={variantOption.id}
                      className={`sales-variant-item${isSelected ? ' selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => handleVariantToggle(variantOption.id, event.target.checked)}
                      />
                      <img
                        src={variantOption.image}
                        alt={variantOption.name}
                        loading="lazy"
                        className="sales-variant-thumb"
                      />
                      <span className="sales-variant-meta">
                        <strong>{variantOption.product_name}</strong>
                        <span>{variantOption.name}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            <span className="caption">{form.variant_ids.length} variant(s) selected</span>
          </div>

          <div className="field-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              <span className="caption">Starts at</span>
              <input className="input" type="datetime-local" value={form.starts_at} onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))} />
            </label>
            <label>
              <span className="caption">Ends at</span>
              <input className="input" type="datetime-local" value={form.ends_at} onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))} />
            </label>
          </div>

          <div className="row" style={{ gap: '16px', flexWrap: 'wrap' }}>
            <label className="caption" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
              Active
            </label>
          </div>

          <div className="actions" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="button button-primary" disabled={saving || !formIsValid}>
              {saving ? 'Saving...' : isEditing ? 'Update sale' : 'Create sale'}
            </button>
          </div>
        </form>
      </section>

      <section className="content-card">
        <div className="toolbar" style={{ marginBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Sales list</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {promotionCountLabel} · {products.length} available products
            </p>
          </div>
          <label className="admin-archive-toggle">
            <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
            Active only
          </label>
        </div>

        {loading ? <div className="notice">Loading sales...</div> : null}

        {!loading ? (
          <div className="admin-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="admin-data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Offer</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Variants</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Schedule</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => (
                  <tr key={promotion.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td data-label="Name" style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 600 }}>{promotion.name}</div>
                      <div className="muted" style={{ fontSize: '12px' }}>{promotion.description || '-'}</div>
                    </td>
                    <td data-label="Offer" style={{ padding: '10px' }}>{summarizePromotion(promotion)}</td>
                    <td data-label="Variants" style={{ padding: '10px' }}>
                      {(() => {
                        const targetVariants = getTargetVariants(promotion)
                        const visibleTargetVariants = targetVariants.slice(0, 3)
                        const extraTargetCount = targetVariants.length - visibleTargetVariants.length

                        if (!targetVariants.length) {
                          return '-'
                        }

                        return (
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {visibleTargetVariants.map((variantItem) => (
                              <div key={`${promotion.id}-${variantItem.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img
                                  src={variantItem.image}
                                  alt={variantItem.name}
                                  loading="lazy"
                                  style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-border)' }}
                                />
                                <span style={{ fontSize: '12px' }}>{variantItem.name}</span>
                              </div>
                            ))}
                            {extraTargetCount > 0 ? (
                              <span className="muted" style={{ fontSize: '12px' }}>
                                +{extraTargetCount} more
                              </span>
                            ) : null}
                          </div>
                        )
                      })()}
                    </td>
                    <td data-label="Schedule" style={{ padding: '10px' }}>
                      <div className="muted" style={{ fontSize: '12px' }}>Start: {promotion.starts_at ? new Date(promotion.starts_at).toLocaleString() : 'Now'}</div>
                      <div className="muted" style={{ fontSize: '12px' }}>End: {promotion.ends_at ? new Date(promotion.ends_at).toLocaleString() : 'Open'}</div>
                    </td>
                    <td data-label="Status" style={{ padding: '10px' }}>
                      <span className={`status-pill ${statusTone(promotion.status)}`}>{promotion.status}</span>
                    </td>
                    <td data-label="Actions" style={{ padding: '10px', textAlign: 'right' }}>
                      <div className="admin-table-actions" style={{ display: 'inline-flex', gap: '8px' }}>
                        <button type="button" className="button button-secondary" onClick={() => startEdit(promotion)}>Edit</button>
                        <button type="button" className="button button-secondary" onClick={() => handleToggle(promotion)}>
                          {promotion.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="button button-secondary" onClick={() => handleDelete(promotion.id)} style={{ color: 'var(--color-error-text)' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!promotions.length ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center' }} className="muted">
                      No product sales yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default AdminPromotionsPage
