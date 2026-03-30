import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import {
  createAdminProduct,
  createAdminProductVariant,
  deleteAdminProduct,
  deleteAdminProductVariant,
  getAdminProducts,
  getCategories,
  readResource,
  updateAdminProduct,
  updateAdminProductVariant,
} from '../lib/api.js'

const REFRESH_INTERVAL_MS = 12000

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

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  category_id: '',
}

const emptyEditProductForm = {
  name: '',
  slug: '',
  description: '',
  category_id: '',
  is_active: true,
}

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
  if (!base) {
    return ''
  }

  const stamp = Date.now().toString(36).slice(-4)
  return `${base}-${stamp}`
}

function generateVariantSku(productSlug, variantName, index) {
  const productPart = slugify(productSlug || 'product').replace(/-/g, '').toUpperCase().slice(0, 10)
  const variantPart = slugify(variantName || `variant-${index + 1}`).replace(/-/g, '').toUpperCase().slice(0, 10)
  const fallbackPart = `VAR${index + 1}`
  const timestampPart = Date.now().toString(36).toUpperCase().slice(-4)
  const left = productPart || 'PRODUCT'
  const right = variantPart || fallbackPart

  return `${left}-${right}-${timestampPart}`
}

function normalizeColorHex(value) {
  const color = String(value || '').trim().toLowerCase()

  if (/^#[0-9a-f]{6}$/.test(color)) {
    return color
  }

  if (/^#[0-9a-f]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }

  return '#2563eb'
}

function extractVariantImageUrl(variant) {
  return variant?.image_url || variant?.attributes?.image_url || ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Image preview failed to load.'))
    reader.readAsDataURL(file)
  })
}

function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [slugTouched, setSlugTouched] = useState(false)
  const [variants, setVariants] = useState([{ ...defaultVariant }])
  const [imageFile, setImageFile] = useState(null)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingProductId, setEditingProductId] = useState(null)
  const [editProductForm, setEditProductForm] = useState(emptyEditProductForm)
  const [editVariants, setEditVariants] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadError, setLoadError] = useState('')

  const categoryOptions = useMemo(() => {
    return [...categories].sort((left, right) => left.name.localeCompare(right.name))
  }, [categories])

  function extractRequestError(requestError, fallbackMessage) {
    const payload = requestError?.response?.data

    if (payload?.errors && typeof payload.errors === 'object') {
      const firstError = Object.values(payload.errors)?.[0]
      if (Array.isArray(firstError) && firstError[0]) {
        return firstError[0]
      }
    }

    return payload?.message || fallbackMessage
  }

  async function loadData({ background = false } = {}) {
    if (!background) {
      setLoadingProducts(true)
      setLoadingCategories(true)
      setLoadError('')
    }

    const [productsResult, categoriesResult] = await Promise.allSettled([
      getAdminProducts({ per_page: 20 }),
      getCategories(),
    ])

    if (productsResult.status === 'fulfilled') {
      const productPayload = readResource(productsResult.value)
      const parsedProducts = productPayload?.data?.data ?? productPayload?.data ?? []
      setProducts(Array.isArray(parsedProducts) ? parsedProducts : [])
    } else if (!background) {
      setProducts([])
      setLoadError('Current products failed to load. Please verify admin auth and backend API.')
    }

    if (categoriesResult.status === 'fulfilled') {
      const categoryPayload = readResource(categoriesResult.value)
      const parsedCategories = categoryPayload?.data ?? []
      setCategories(Array.isArray(parsedCategories) ? parsedCategories : [])
    } else if (!background) {
      setCategories([])
      setLoadError((current) => current || 'Categories failed to load. Product creation may be limited.')
    }

    if (!background) {
      setLoadingProducts(false)
      setLoadingCategories(false)
    }
  }

  useEffect(() => {
    let active = true

    async function boot() {
      if (!active) {
        return
      }

      await loadData()
    }

    function refreshVisibleData() {
      if (document.hidden || !active) {
        return
      }

      loadData({ background: true })
    }

    boot()

    const intervalId = window.setInterval(refreshVisibleData, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshVisibleData)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVisibleData)
    }
  }, [])

  useEffect(() => {
    if (!categoryOptions.length) {
      setForm((current) => (current.category_id ? { ...current, category_id: '' } : current))
      return
    }

    const hasSelectedCategory = categoryOptions.some(
      (category) => String(category.id) === String(form.category_id),
    )

    if (!hasSelectedCategory) {
      setForm((current) => ({ ...current, category_id: String(categoryOptions[0].id) }))
    }
  }, [categoryOptions, form.category_id])

  function handleNameChange(value) {
    setForm((current) => {
      const next = { ...current, name: value }

      if (!slugTouched) {
        next.slug = generateSlugFromName(value)
      }

      return next
    })
  }

  function handleSlugChange(value) {
    setSlugTouched(true)
    setForm((current) => ({ ...current, slug: slugify(value) }))
  }

  function handleEditProductChange(field, value) {
    setEditProductForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleEditVariantChange(index, field, value) {
    setEditVariants((current) => {
      const next = [...current]
      next[index] = {
        ...next[index],
        [field]: value,
      }

      return next
    })
  }

  function startEditingProduct(product) {
    const currentVariants = Array.isArray(product.variants) ? product.variants : []

    setEditingProductId(product.id)
    setEditProductForm({
      name: product.name ?? '',
      slug: product.slug ?? '',
      description: product.description ?? '',
      category_id: String(product.category?.id ?? ''),
      is_active: Boolean(product.is_active),
    })
    setEditVariants(currentVariants.map((variant) => ({
      id: variant.id,
      name: variant.name ?? '',
      sku: variant.sku ?? '',
      price: String(variant.price ?? ''),
      stock_quantity: String(variant.stock_quantity ?? 0),
      color_hex: normalizeColorHex(variant.color_hex ?? variant.attributes?.color_hex),
      image_file: null,
      image_preview: extractVariantImageUrl(variant),
      remove_image: false,
      is_active: Boolean(variant.is_active),
    })))
    setError('')
    setSuccess('')
  }

  function cancelEditingProduct() {
    setEditingProductId(null)
    setEditProductForm(emptyEditProductForm)
    setEditVariants([])
  }

  function addEditVariant() {
    setEditVariants((current) => {
      const nextIndex = current.length
      const generatedSku = generateVariantSku(editProductForm.slug, `variant-${nextIndex + 1}`, nextIndex)

      return [
        ...current,
        {
          id: null,
          name: '',
          sku: generatedSku,
          price: '',
          stock_quantity: '0',
          color_hex: '#2563eb',
          image_file: null,
          image_preview: '',
          remove_image: false,
          is_active: true,
        },
      ]
    })
  }

  async function removeEditVariant(index) {
    const targetVariant = editVariants[index]

    if (!targetVariant) {
      return
    }

    if (!targetVariant.id) {
      setEditVariants((current) => current.filter((_, currentIndex) => currentIndex !== index))
      return
    }

    if (!window.confirm('Delete this variant?')) {
      return
    }

    setSavingEdit(true)

    try {
      await deleteAdminProductVariant(editingProductId, targetVariant.id)
      setEditVariants((current) => current.filter((_, currentIndex) => currentIndex !== index))
      setSuccess('Variant deleted successfully.')
      setError('')
      await loadData({ background: true })
    } catch (requestError) {
      setError(extractRequestError(requestError, 'Variant could not be deleted right now.'))
      setSuccess('')
    } finally {
      setSavingEdit(false)
    }
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
      next[index] = {
        ...next[index],
        image_file: file,
        image_preview: preview,
        remove_image: false,
      }
      return next
    })
  }

  async function handleEditVariantImageChange(index, file) {
    if (!file) {
      handleEditVariantChange(index, 'image_file', null)
      return
    }

    const preview = await readFileAsDataUrl(file)

    setEditVariants((current) => {
      const next = [...current]
      next[index] = {
        ...next[index],
        image_file: file,
        image_preview: preview,
        remove_image: false,
      }
      return next
    })
  }

  function clearVariantImage(index) {
    setVariants((current) => {
      const next = [...current]
      next[index] = {
        ...next[index],
        image_file: null,
        image_preview: '',
        remove_image: true,
      }
      return next
    })
  }

  function clearEditVariantImage(index) {
    setEditVariants((current) => {
      const next = [...current]
      next[index] = {
        ...next[index],
        image_file: null,
        image_preview: '',
        remove_image: true,
      }
      return next
    })
  }

  function addVariant() {
    setVariants((current) => [...current, { ...defaultVariant }])
  }

  function removeVariant(index) {
    setVariants((current) => {
      if (current.length <= 1) {
        return current
      }

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  function validateVariants() {
    for (const variant of variants) {
      if (!variant.name.trim() || variant.price === '') {
        return 'Every variant needs name and price.'
      }
    }

    return ''
  }

  function buildVariantPayload(variant, sku) {
    const normalizedColor = normalizeColorHex(variant.color_hex)
    const normalizedStock = Number(variant.stock_quantity || 0)
    const normalizedPrice = Number(variant.price)

    const nextAttributes = {
      color_hex: normalizedColor,
    }

    if (variant.remove_image) {
      nextAttributes.image_url = ''
    }

    if (variant.image_file) {
      const payload = new FormData()
      payload.append('name', variant.name.trim())
      payload.append('sku', sku.trim())
      payload.append('price', String(normalizedPrice))
      payload.append('stock_quantity', String(normalizedStock))
      payload.append('condition', 'new')
      payload.append('is_active', variant.is_active ? '1' : '0')
      payload.append('attributes[color_hex]', normalizedColor)
      if (variant.remove_image) {
        payload.append('attributes[image_url]', '')
      }
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

  async function handleCreateProduct() {
    if (!form.name.trim() || !form.slug.trim() || !form.category_id) {
      setError('Product name, slug, and category are required.')
      setSuccess('')
      return
    }

    const variantsError = validateVariants()

    if (variantsError) {
      setError(variantsError)
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const hasImage = Boolean(imageFile)
      let payload

      if (hasImage) {
        payload = new FormData()
        payload.append('name', form.name.trim())
        payload.append('slug', form.slug.trim())
        payload.append('category_id', String(form.category_id))
        payload.append('description', form.description.trim())
        payload.append('image', imageFile)
      } else {
        payload = {
          name: form.name.trim(),
          slug: form.slug.trim(),
          category_id: Number(form.category_id),
          description: form.description.trim(),
        }
      }

      const response = await createAdminProduct(payload)
      const createdProduct = response?.data?.product?.data ?? response?.data?.product ?? null

      if (!createdProduct?.id) {
        throw new Error('Product was created but no product ID was returned.')
      }

      for (const [index, variant] of variants.entries()) {
        const generatedSku = generateVariantSku(form.slug, variant.name, index)
        const variantPayload = buildVariantPayload(variant, generatedSku)

        await createAdminProductVariant(createdProduct.id, variantPayload)
      }

      if (createdProduct) {
        const refreshedProducts = await getAdminProducts({ per_page: 20 })
        const refreshedPayload = readResource(refreshedProducts)
        const parsedProducts = refreshedPayload?.data?.data ?? refreshedPayload?.data ?? []
        setProducts(Array.isArray(parsedProducts) ? parsedProducts : [])
      } else {
        const refreshedProducts = await getAdminProducts({ per_page: 20 })
        const refreshedPayload = readResource(refreshedProducts)
        const parsedProducts = refreshedPayload?.data?.data ?? refreshedPayload?.data ?? []
        setProducts(Array.isArray(parsedProducts) ? parsedProducts : [])
      }

      setForm(emptyForm)
      setSlugTouched(false)
      setVariants([{ ...defaultVariant }])
      setImageFile(null)
      setSuccess('Product and variants created successfully.')
    } catch (requestError) {
      setError(extractRequestError(requestError, 'Product could not be created right now.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveProductEdits() {
    if (!editingProductId) {
      return
    }

    if (!editProductForm.name.trim() || !editProductForm.slug.trim() || !editProductForm.category_id) {
      setError('Edited product requires name, slug, and category.')
      setSuccess('')
      return
    }

    for (const variant of editVariants) {
      if (!variant.name.trim() || !variant.sku.trim() || variant.price === '') {
        setError('Each variant requires name, SKU, and price.')
        setSuccess('')
        return
      }
    }

    setSavingEdit(true)
    setError('')
    setSuccess('')

    try {
      await updateAdminProduct(editingProductId, {
        name: editProductForm.name.trim(),
        slug: editProductForm.slug.trim(),
        description: editProductForm.description.trim(),
        category_id: Number(editProductForm.category_id),
        is_active: Boolean(editProductForm.is_active),
      })

      for (const variant of editVariants) {
        const variantPayload = buildVariantPayload(variant, variant.sku)

        if (variant.id) {
          await updateAdminProductVariant(editingProductId, variant.id, variantPayload)
        } else {
          await createAdminProductVariant(editingProductId, variantPayload)
        }
      }

      await loadData({ background: true })
      setSuccess('Product and variants updated successfully.')
      setError('')
      cancelEditingProduct()
    } catch (requestError) {
      setError(extractRequestError(requestError, 'Product updates failed. Please retry.'))
      setSuccess('')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteProduct(productId) {
    if (!window.confirm('Delete this product and all its variants?')) {
      return
    }

    setDeletingProductId(productId)
    setError('')
    setSuccess('')

    try {
      await deleteAdminProduct(productId)
      if (editingProductId === productId) {
        cancelEditingProduct()
      }

      await loadData({ background: true })
      setSuccess('Product deleted successfully.')
    } catch (requestError) {
      setError(extractRequestError(requestError, 'Product could not be deleted right now.'))
    } finally {
      setDeletingProductId(null)
    }
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Catalog management"
        title="Product Control"
        description="Create products with generated slugs, images, and multiple variants."
      />

      <section className="grid admin-products-layout">
        <div className="form-card admin-product-form-card">
          <div className="admin-product-form-head">
            <div>
              <h3>Create product</h3>
              <p className="muted admin-product-form-subtitle">
                Fill core details, then add variants before publishing.
              </p>
            </div>
          </div>

          <div className="admin-product-section">
            <p className="admin-product-section-title">Product details</p>
            <div className="field-grid admin-product-fields">
            <input
              className="input"
              placeholder="Product name"
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
            />
            <input
              className="input"
              placeholder="Slug (auto-generated, editable)"
              value={form.slug}
              onChange={(event) => handleSlugChange(event.target.value)}
            />
            <select
              className="select"
              value={form.category_id}
              disabled={loadingCategories || categoryOptions.length === 0}
              onChange={(event) => setForm({ ...form, category_id: event.target.value })}
            >
              <option value="">
                {loadingCategories
                  ? 'Loading categories...'
                  : categoryOptions.length
                    ? 'Select category'
                    : 'No categories available'}
              </option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <textarea
              className="textarea"
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
            </div>
          </div>

          <div className="stack admin-product-variants-stack">
            <div className="row admin-product-variants-head">
              <h3 className="admin-product-inline-title">Variants</h3>
              <button type="button" className="button button-secondary" onClick={addVariant}>
                Add variant
              </button>
            </div>

            {variants.map((variant, index) => (
              <div key={`variant-${index}`} className="content-card admin-product-variant-card">
                <div className="field-grid admin-product-fields">
                  <input
                    className="input"
                    placeholder="Variant name"
                    value={variant.name}
                    onChange={(event) => handleVariantChange(index, 'name', event.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="SKU (auto-generated)"
                    value={generateVariantSku(form.slug, variant.name, index)}
                    readOnly
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={variant.price}
                    onChange={(event) => handleVariantChange(index, 'price', event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="Stock quantity"
                    value={variant.stock_quantity}
                    onChange={(event) => handleVariantChange(index, 'stock_quantity', event.target.value)}
                  />
                  <input
                    className="input"
                    type="color"
                    title="Variant color"
                    value={normalizeColorHex(variant.color_hex)}
                    onChange={(event) => handleVariantChange(index, 'color_hex', event.target.value)}
                  />
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      await handleVariantImageChange(index, event.target.files?.[0] ?? null)
                    }}
                  />
                </div>
                {variant.image_preview ? (
                  <img
                    className="admin-product-variant-preview"
                    src={variant.image_preview}
                    alt={`${variant.name || 'Variant'} preview`}
                  />
                ) : null}
                {variant.image_preview ? (
                  <div className="actions admin-product-variant-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => clearVariantImage(index)}
                    >
                      Remove image
                    </button>
                  </div>
                ) : null}
                {variants.length > 1 ? (
                  <div className="actions admin-product-variant-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => removeVariant(index)}
                    >
                      Remove variant
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {imageFile ? <p className="caption admin-product-image-caption">Selected image: {imageFile.name}</p> : null}
          {success ? <div className="notice">{success}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}
          <div className="admin-product-submit-wrap">
            <button
              type="button"
              className="button button-primary"
              onClick={handleCreateProduct}
              disabled={saving}
            >
              {saving ? 'Saving product...' : 'Save product'}
            </button>
          </div>
        </div>

        <div className="summary-card admin-products-summary-card">
          <h3>Current products</h3>
          <div className="divider" />
          {loadingProducts ? <p className="muted">Loading products...</p> : null}
          {loadError ? <div className="notice error">{loadError}</div> : null}
          <div className="stack">
            {!loadingProducts && products.length === 0 ? (
              <p className="muted">No products found. Create one using the form.</p>
            ) : null}
            {products.map((product) => (
              <div key={product.id} className="content-card admin-product-row-card">
                <div className="row admin-product-row-head">
                  <div>
                    <span>{product.name}</span>
                    <p className="muted" style={{ margin: '4px 0 0' }}>{product.slug}</p>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => startEditingProduct(product)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={deletingProductId === product.id}
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      {deletingProductId === product.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
                <p className="caption" style={{ margin: '8px 0 0' }}>
                  Variants: {product.variants?.length ?? 0}
                </p>

                {editingProductId === product.id ? (
                  <div className="stack admin-product-edit-stack">
                    <div className="field-grid admin-product-fields">
                      <input
                        className="input"
                        placeholder="Product name"
                        value={editProductForm.name}
                        onChange={(event) => handleEditProductChange('name', event.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Slug"
                        value={editProductForm.slug}
                        onChange={(event) => handleEditProductChange('slug', slugify(event.target.value))}
                      />
                      <select
                        className="select"
                        value={editProductForm.category_id}
                        onChange={(event) => handleEditProductChange('category_id', event.target.value)}
                      >
                        <option value="">Select category</option>
                        {categoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select"
                        value={editProductForm.is_active ? '1' : '0'}
                        onChange={(event) => handleEditProductChange('is_active', event.target.value === '1')}
                      >
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </div>

                    <textarea
                      className="textarea"
                      placeholder="Description"
                      value={editProductForm.description}
                      onChange={(event) => handleEditProductChange('description', event.target.value)}
                    />

                    <div className="row admin-product-variants-head">
                      <h3 className="admin-product-inline-title">Edit variants</h3>
                      <button type="button" className="button button-secondary" onClick={addEditVariant}>
                        Add variant
                      </button>
                    </div>

                    <div className="admin-product-edit-variants-scroll stack">
                      {editVariants.map((variant, index) => (
                        <div
                          key={`edit-variant-${variant.id ?? index}`}
                          className="content-card admin-product-variant-card"
                        >
                          <div className="field-grid admin-product-fields">
                          <input
                            className="input"
                            placeholder="Variant name"
                            value={variant.name}
                            onChange={(event) => handleEditVariantChange(index, 'name', event.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="SKU"
                            value={variant.sku}
                            onChange={(event) => handleEditVariantChange(index, 'sku', event.target.value)}
                          />
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Price"
                            value={variant.price}
                            onChange={(event) => handleEditVariantChange(index, 'price', event.target.value)}
                          />
                          <input
                            className="input"
                            type="number"
                            min="0"
                            placeholder="Stock"
                            value={variant.stock_quantity}
                            onChange={(event) => handleEditVariantChange(index, 'stock_quantity', event.target.value)}
                          />
                          <input
                            className="input"
                            type="color"
                            title="Variant color"
                            value={normalizeColorHex(variant.color_hex)}
                            onChange={(event) => handleEditVariantChange(index, 'color_hex', event.target.value)}
                          />
                          <input
                            className="input"
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                              await handleEditVariantImageChange(index, event.target.files?.[0] ?? null)
                            }}
                          />
                          <select
                            className="select"
                            value={variant.is_active ? '1' : '0'}
                            onChange={(event) => handleEditVariantChange(index, 'is_active', event.target.value === '1')}
                          >
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                          </select>
                          </div>

                          {variant.image_preview ? (
                            <img
                              className="admin-product-variant-preview"
                              src={variant.image_preview}
                              alt={`${variant.name || 'Variant'} preview`}
                            />
                          ) : null}

                          {variant.image_preview ? (
                            <div className="actions admin-product-variant-actions">
                              <button
                                type="button"
                                className="button button-secondary"
                                disabled={savingEdit}
                                onClick={() => clearEditVariantImage(index)}
                              >
                                Remove image
                              </button>
                            </div>
                          ) : null}

                          <div className="actions admin-product-variant-actions">
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={savingEdit}
                              onClick={() => removeEditVariant(index)}
                            >
                              Remove variant
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="actions admin-product-edit-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={savingEdit}
                        onClick={handleSaveProductEdits}
                      >
                        {savingEdit ? 'Saving changes...' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={savingEdit}
                        onClick={cancelEditingProduct}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {loadingCategories && !categories.length ? (
        <div className="notice">Loading categories...</div>
      ) : null}
    </div>
  )
}

export default AdminProductsPage