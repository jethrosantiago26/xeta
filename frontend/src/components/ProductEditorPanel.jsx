import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2, ImageIcon, Package } from 'lucide-react'
import {
  createAdminProduct,
  createAdminProductVariant,
  deleteAdminProductVariant,
  getAssetUrl,
  getCategories,
  readResource,
  updateAdminProduct,
  updateAdminProductVariant,
} from '../lib/api.js'

/* ─── Helpers ─── */

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function generateSlugFromName(name) {
  const base = slugify(name)
  if (!base) return ''
  const stamp = Date.now().toString(36).slice(-4)
  return `${base}-${stamp}`
}

function generateVariantSku(productSlug, variantName, index) {
  const productPart = slugify(productSlug || 'product').replace(/-/g, '').toUpperCase().slice(0, 10)
  const variantPart = slugify(variantName || `variant-${index + 1}`).replace(/-/g, '').toUpperCase().slice(0, 10)
  const timestampPart = Date.now().toString(36).toUpperCase().slice(-4)
  return `${productPart || 'PRODUCT'}-${variantPart || `VAR${index + 1}`}-${timestampPart}`
}

function normalizeColorHex(value) {
  const color = String(value || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(color)) return color
  if (/^#[0-9a-f]{3}$/.test(color)) return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  return '#2563eb'
}

function extractVariantImageUrl(variant) {
  const imageUrl = variant?.image_url || variant?.attributes?.image_url || ''
  return imageUrl ? getAssetUrl(imageUrl) : ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Image preview failed to load.'))
    reader.readAsDataURL(file)
  })
}

function extractRequestError(requestError, fallbackMessage) {
  const payload = requestError?.response?.data
  if (payload?.errors && typeof payload.errors === 'object') {
    const firstError = Object.values(payload.errors)?.[0]
    if (Array.isArray(firstError) && firstError[0]) return firstError[0]
  }
  return payload?.message || fallbackMessage
}

const defaultVariant = {
  name: 'Default',
  price: '',
  stock_quantity: '0',
  color_hex: '#2563eb',
  image_file: null,
  image_preview: '',
  remove_image: false,
  is_active: true,
}

/* ─── Component ─── */

function ProductEditorPanel({ product, onClose, onSaved }) {
  const isEditing = Boolean(product)

  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  // Product fields
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    category_id: '',
    is_active: true,
  })

  // Variants
  const [variants, setVariants] = useState([{ ...defaultVariant }])

  // Load categories on mount
  useEffect(() => {
    async function load() {
      setLoadingCategories(true)
      try {
        const res = await getCategories()
        const payload = readResource(res)
        setCategories(Array.isArray(payload?.data) ? payload.data : [])
      } catch {
        setCategories([])
      } finally {
        setLoadingCategories(false)
      }
    }
    load()
  }, [])

  // Populate form when editing
  useEffect(() => {
    if (!product) return

    setForm({
      name: product.name ?? '',
      slug: product.slug ?? '',
      description: product.description ?? '',
      category_id: String(product.category?.id ?? ''),
      is_active: Boolean(product.is_active),
    })
    setSlugTouched(true)

    const existingVariants = Array.isArray(product.variants) ? product.variants : []
    setVariants(
      existingVariants.map((v) => ({
        id: v.id,
        name: v.name ?? '',
        sku: v.sku ?? '',
        price: String(v.price ?? ''),
        stock_quantity: String(v.stock_quantity ?? 0),
        color_hex: normalizeColorHex(v.color_hex ?? v.attributes?.color_hex),
        image_file: null,
        image_preview: extractVariantImageUrl(v),
        remove_image: false,
        is_active: Boolean(v.is_active),
      })),
    )
  }, [product])

  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  )

  // Auto-select first category
  useEffect(() => {
    if (!categoryOptions.length) return
    const match = categoryOptions.some((c) => String(c.id) === String(form.category_id))
    if (!match) setForm((f) => ({ ...f, category_id: String(categoryOptions[0].id) }))
  }, [categoryOptions, form.category_id])

  function handleNameChange(value) {
    setForm((f) => {
      const next = { ...f, name: value }
      if (!slugTouched) next.slug = generateSlugFromName(value)
      return next
    })
  }

  function handleFieldChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleVariantChange(index, field, value) {
    setVariants((current) => {
      const next = [...current]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  async function handleVariantImageChange(index, file) {
    if (!file) {
      handleVariantChange(index, 'image_file', null)
      handleVariantChange(index, 'image_preview', '')
      return
    }
    const preview = await readFileAsDataUrl(file)
    setVariants((current) => {
      const next = [...current]
      next[index] = { ...next[index], image_file: file, image_preview: preview, remove_image: false }
      return next
    })
  }

  function clearVariantImage(index) {
    setVariants((current) => {
      const next = [...current]
      next[index] = { ...next[index], image_file: null, image_preview: '', remove_image: true }
      return next
    })
  }

  function addVariant() {
    setVariants((current) => {
      const nextIndex = current.length
      if (isEditing) {
        const generatedSku = generateVariantSku(form.slug, `variant-${nextIndex + 1}`, nextIndex)
        return [
          ...current,
          { ...defaultVariant, id: null, sku: generatedSku, name: '' },
        ]
      }
      return [...current, { ...defaultVariant }]
    })
  }

  async function removeVariant(index) {
    const target = variants[index]
    if (!target) return

    // If persisted variant in edit mode, delete from server
    if (isEditing && target.id) {
      if (!window.confirm('Delete this variant permanently?')) return
      setSaving(true)
      try {
        await deleteAdminProductVariant(product.id, target.id)
        setVariants((current) => current.filter((_, i) => i !== index))
        setSuccess('Variant deleted.')
        setError('')
      } catch (err) {
        setError(extractRequestError(err, 'Could not delete variant.'))
      } finally {
        setSaving(false)
      }
      return
    }

    // Non-persisted, just remove from state
    if (variants.length <= 1) return
    setVariants((current) => current.filter((_, i) => i !== index))
  }

  function buildVariantPayload(variant, sku) {
    const normalizedColor = normalizeColorHex(variant.color_hex)
    const normalizedStock = Number(variant.stock_quantity || 0)
    const normalizedPrice = Number(variant.price)
    const nextAttributes = { color_hex: normalizedColor }
    if (variant.remove_image) nextAttributes.image_url = ''

    if (variant.image_file) {
      const payload = new FormData()
      payload.append('name', variant.name.trim())
      payload.append('sku', sku.trim())
      payload.append('price', String(normalizedPrice))
      payload.append('stock_quantity', String(normalizedStock))
      payload.append('condition', 'new')
      payload.append('is_active', variant.is_active ? '1' : '0')
      payload.append('attributes[color_hex]', normalizedColor)
      if (variant.remove_image) payload.append('attributes[image_url]', '')
      payload.append('image', variant.image_file)
      return payload
    }

    return {
      name: variant.name.trim(),
      sku: sku.trim(),
      price: normalizedPrice,
      compare_at_price: null,
      stock_quantity: normalizedStock,
      attributes: nextAttributes,
      condition: 'new',
      is_active: Boolean(variant.is_active),
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim() || !form.category_id) {
      setError('Product name, slug, and category are required.')
      return
    }

    for (const v of variants) {
      if (!v.name.trim() || v.price === '') {
        setError('Every variant needs a name and price.')
        return
      }
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (isEditing) {
        // Update product
        await updateAdminProduct(product.id, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim(),
          category_id: Number(form.category_id),
          is_active: Boolean(form.is_active),
        })

        // Update/create variants
        for (const [index, variant] of variants.entries()) {
          const sku = variant.sku || generateVariantSku(form.slug, variant.name, index)
          const payload = buildVariantPayload(variant, sku)
          if (variant.id) {
            await updateAdminProductVariant(product.id, variant.id, payload)
          } else {
            await createAdminProductVariant(product.id, payload)
          }
        }

        setSuccess('Product updated successfully.')
      } else {
        // Create product
        const productPayload = {
          name: form.name.trim(),
          slug: form.slug.trim(),
          category_id: Number(form.category_id),
          description: form.description.trim(),
        }
        const response = await createAdminProduct(productPayload)
        const createdProduct = response?.data?.product?.data ?? response?.data?.product ?? null
        if (!createdProduct?.id) throw new Error('Product created but no ID returned.')

        // Create variants
        for (const [index, variant] of variants.entries()) {
          const sku = generateVariantSku(form.slug, variant.name, index)
          const payload = buildVariantPayload(variant, sku)
          await createAdminProductVariant(createdProduct.id, payload)
        }

        setSuccess('Product created successfully.')
      }

      if (onSaved) onSaved()

      // Auto-close after brief delay so user sees success
      setTimeout(() => onClose(), 800)
    } catch (err) {
      setError(extractRequestError(err, 'Operation failed. Please retry.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="product-editor-panel">
      {/* Header */}
      <div className="product-editor-header">
        <div>
          <div className="product-editor-eyebrow">
            {isEditing ? 'Edit Product' : 'New Product'}
          </div>
          <h2 className="product-editor-title">
            {isEditing ? form.name || 'Untitled' : 'Create Product'}
          </h2>
        </div>
        <button onClick={onClose} className="admin-modal-close" aria-label="Close panel">
          <X size={24} />
        </button>
      </div>

      {/* Body */}
      <div className="product-editor-body">
        {/* Feedback */}
        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice">{success}</div>}

        {/* Product Details Section */}
        <section className="product-editor-section">
          <div className="product-editor-section-header">
            <Package size={16} />
            <span>Product Details</span>
          </div>

          <div className="product-editor-fields">
            <div className="product-editor-field">
              <label className="product-editor-label">Name</label>
              <input
                className="input"
                placeholder="e.g. RGB Mechanical Keyboard"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="product-editor-field">
              <label className="product-editor-label">Slug</label>
              <input
                className="input"
                placeholder="auto-generated-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  handleFieldChange('slug', slugify(e.target.value))
                }}
              />
            </div>

            <div className="product-editor-field">
              <label className="product-editor-label">Category</label>
              <select
                className="select"
                value={form.category_id}
                disabled={loadingCategories || !categoryOptions.length}
                onChange={(e) => handleFieldChange('category_id', e.target.value)}
              >
                <option value="">
                  {loadingCategories
                    ? 'Loading...'
                    : categoryOptions.length
                      ? 'Select category'
                      : 'No categories'}
                </option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {isEditing && (
              <div className="product-editor-field">
                <label className="product-editor-label">Status</label>
                <select
                  className="select"
                  value={form.is_active ? '1' : '0'}
                  onChange={(e) => handleFieldChange('is_active', e.target.value === '1')}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            )}

            <div className="product-editor-field product-editor-field-full">
              <label className="product-editor-label">Description</label>
              <textarea
                className="textarea"
                placeholder="Write a compelling description..."
                rows={3}
                value={form.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Variants Section */}
        <section className="product-editor-section">
          <div className="product-editor-section-header">
            <span style={{ fontSize: '16px' }}>⬡</span>
            <span>Variants</span>
            <button type="button" className="button button-secondary" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '12px' }} onClick={addVariant}>
              <Plus size={14} /> Add Variant
            </button>
          </div>

          <div className="product-editor-variants">
            {variants.map((variant, index) => (
              <div key={variant.id ?? `new-${index}`} className="product-editor-variant-card">
                <div className="product-editor-variant-header">
                  <div
                    className="product-editor-variant-color-dot"
                    style={{ background: normalizeColorHex(variant.color_hex) }}
                  />
                  <span className="product-editor-variant-name">
                    {variant.name || `Variant ${index + 1}`}
                  </span>
                  <button
                    type="button"
                    className="product-editor-variant-remove"
                    onClick={() => removeVariant(index)}
                    disabled={saving || (!isEditing && variants.length <= 1)}
                    title="Remove variant"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="product-editor-variant-fields">
                  <div className="product-editor-field">
                    <label className="product-editor-label">Name</label>
                    <input
                      className="input"
                      placeholder="Variant name"
                      value={variant.name}
                      onChange={(e) => handleVariantChange(index, 'name', e.target.value)}
                    />
                  </div>

                  {isEditing && (
                    <div className="product-editor-field">
                      <label className="product-editor-label">SKU</label>
                      <input
                        className="input"
                        placeholder="SKU"
                        value={variant.sku || generateVariantSku(form.slug, variant.name, index)}
                        onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                        readOnly={!isEditing}
                      />
                    </div>
                  )}

                  <div className="product-editor-field">
                    <label className="product-editor-label">Price</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={variant.price}
                      onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                    />
                  </div>

                  <div className="product-editor-field">
                    <label className="product-editor-label">Stock</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={variant.stock_quantity}
                      onChange={(e) => handleVariantChange(index, 'stock_quantity', e.target.value)}
                    />
                  </div>

                  <div className="product-editor-field">
                    <label className="product-editor-label">Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="color"
                        value={normalizeColorHex(variant.color_hex)}
                        onChange={(e) => handleVariantChange(index, 'color_hex', e.target.value)}
                        style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                        {normalizeColorHex(variant.color_hex)}
                      </span>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="product-editor-field">
                      <label className="product-editor-label">Status</label>
                      <select
                        className="select"
                        value={variant.is_active ? '1' : '0'}
                        onChange={(e) => handleVariantChange(index, 'is_active', e.target.value === '1')}
                      >
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Image area */}
                <div className="product-editor-variant-image-area">
                  {variant.image_preview ? (
                    <div className="product-editor-variant-image-wrap">
                      <img src={variant.image_preview} alt="" />
                      <label className="product-editor-variant-image-change">
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            await handleVariantImageChange(index, e.target.files?.[0] ?? null)
                          }}
                        />
                        <ImageIcon size={14} />
                        <span>Change</span>
                      </label>
                      <button
                        type="button"
                        className="product-editor-variant-image-remove"
                        onClick={() => clearVariantImage(index)}
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="product-editor-variant-image-upload">
                      <ImageIcon size={20} />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          await handleVariantImageChange(index, e.target.files?.[0] ?? null)
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="product-editor-footer">
        <button
          type="button"
          className="button button-secondary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? (isEditing ? 'Saving...' : 'Creating...')
            : (isEditing ? 'Save Changes' : 'Create Product')}
        </button>
      </div>
    </div>
  )
}

export default ProductEditorPanel
