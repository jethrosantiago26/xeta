import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import {
  createAdminProduct,
  createAdminProductVariant,
  getAdminProducts,
  getCategories,
  readResource,
} from '../lib/api.js'

const defaultVariant = {
  name: 'Default',
  price: '',
  stock_quantity: '0',
  is_active: true,
}

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  category_id: '',
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

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoadingProducts(true)
      setLoadingCategories(true)
      setLoadError('')

      const [productsResult, categoriesResult] = await Promise.allSettled([
        getAdminProducts({ per_page: 20 }),
        getCategories(),
      ])

      if (!active) {
        return
      }

      if (productsResult.status === 'fulfilled') {
        const productPayload = readResource(productsResult.value)
        const parsedProducts = productPayload?.data?.data ?? productPayload?.data ?? []
        setProducts(Array.isArray(parsedProducts) ? parsedProducts : [])
      } else {
        setProducts([])
        setLoadError('Current products failed to load. Please verify admin auth and backend API.')
      }

      if (categoriesResult.status === 'fulfilled') {
        const categoryPayload = readResource(categoriesResult.value)
        const parsedCategories = categoryPayload?.data ?? []
        setCategories(Array.isArray(parsedCategories) ? parsedCategories : [])
      } else {
        setCategories([])
        setLoadError((current) => current || 'Categories failed to load. Product creation may be limited.')
      }

      setLoadingProducts(false)
      setLoadingCategories(false)
    }

    loadData()

    return () => {
      active = false
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

  function handleVariantChange(index, field, value) {
    setVariants((current) => {
      const next = [...current]
      next[index] = { ...next[index], [field]: value }
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

        await createAdminProductVariant(createdProduct.id, {
          name: variant.name.trim(),
          sku: generatedSku,
          price: Number(variant.price),
          compare_at_price: null,
          stock_quantity: Number(variant.stock_quantity || 0),
          condition: 'new',
          is_active: Boolean(variant.is_active),
        })
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

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Catalog management"
        title="Product Control"
        description="Create products with generated slugs, images, and multiple variants."
      />

      <section className="grid cards">
        <div className="form-card">
          <h3>Create product</h3>
          <div className="field-grid" style={{ marginTop: '14px' }}>
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

          <div className="stack" style={{ marginTop: '14px', gap: '10px' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>Variants</h3>
              <button type="button" className="button button-secondary" onClick={addVariant}>
                Add variant
              </button>
            </div>

            {variants.map((variant, index) => (
              <div key={`variant-${index}`} className="content-card" style={{ padding: '14px' }}>
                <div className="field-grid">
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
                </div>
                {variants.length > 1 ? (
                  <div className="actions" style={{ marginTop: '10px' }}>
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

          {imageFile ? <p className="caption" style={{ marginTop: '10px' }}>Selected image: {imageFile.name}</p> : null}
          {success ? <div className="notice">{success}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}
          <button
            type="button"
            className="button button-primary"
            style={{ marginTop: '14px' }}
            onClick={handleCreateProduct}
            disabled={saving}
          >
            {saving ? 'Saving product...' : 'Save product'}
          </button>
        </div>

        <div className="summary-card">
          <h3>Current products</h3>
          <div className="divider" />
          {loadingProducts ? <p className="muted">Loading products...</p> : null}
          {loadError ? <div className="notice error">{loadError}</div> : null}
          <div className="stack">
            {!loadingProducts && products.length === 0 ? (
              <p className="muted">No products found. Create one using the form.</p>
            ) : null}
            {products.map((product) => (
              <div key={product.id} className="content-card" style={{ padding: '12px' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{product.name}</span>
                  <span className="muted">{product.slug}</span>
                </div>
                <p className="caption" style={{ margin: '8px 0 0' }}>
                  Variants: {product.variants?.length ?? 0}
                </p>
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