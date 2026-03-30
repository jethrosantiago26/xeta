import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { getCategories, getProducts, readResource } from '../lib/api.js'

const REFRESH_INTERVAL_MS = 15000

function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)

  const filters = {
    search: searchParams.get('search') ?? '',
    category: searchParams.get('category') ?? '',
    sort: searchParams.get('sort') ?? 'latest',
    min_price: searchParams.get('min_price') ?? '',
    max_price: searchParams.get('max_price') ?? '',
    in_stock: searchParams.get('in_stock') ?? '',
  }

  const loadProducts = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true)
    }

    const requestFilters = {
      search: searchParams.get('search') ?? '',
      category: searchParams.get('category') ?? '',
      sort: searchParams.get('sort') ?? 'latest',
      min_price: searchParams.get('min_price') ?? '',
      max_price: searchParams.get('max_price') ?? '',
      in_stock: searchParams.get('in_stock') ?? '',
    }

    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        getProducts({
          ...Object.fromEntries(
            Object.entries(requestFilters).filter(([, value]) => value !== ''),
          ),
          per_page: 12,
        }),
        getCategories(),
      ])

      const productPayload = readResource(productsResponse)
      const categoryPayload = readResource(categoriesResponse)

      setProducts(productPayload.data ?? [])
      setMeta(productPayload.meta ?? null)
      setCategories(categoryPayload.data ?? [])
    } catch {
      if (!background) {
        setProducts([])
        setMeta(null)
        setCategories([])
      }
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, [searchParams])

  useEffect(() => {
    let active = true

    async function boot() {
      if (!active) {
        return
      }

      await loadProducts()
    }

    function refreshVisibleData() {
      if (document.hidden || !active) {
        return
      }

      loadProducts({ background: true })
    }

    boot()

    const intervalId = window.setInterval(refreshVisibleData, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshVisibleData)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVisibleData)
    }
  }, [loadProducts])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)

    if (!value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }

    setSearchParams(next)
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Filter peripherals by price, stock, and category."
      />

      <section className="filter-panel">
        <div className="field-grid">
          <input
            className="input"
            placeholder="Search products"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
          <select
            className="select"
            value={filters.category}
            onChange={(event) => updateFilter('category', event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={filters.sort}
            onChange={(event) => updateFilter('sort', event.target.value)}
          >
            <option value="latest">Newest</option>
            <option value="price_asc">Price low to high</option>
            <option value="price_desc">Price high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>

        <div className="field-grid" style={{ marginTop: '12px' }}>
          <input
            className="input"
            type="number"
            min="0"
            placeholder="Min price"
            value={filters.min_price}
            onChange={(event) => updateFilter('min_price', event.target.value)}
          />
          <input
            className="input"
            type="number"
            min="0"
            placeholder="Max price"
            value={filters.max_price}
            onChange={(event) => updateFilter('max_price', event.target.value)}
          />
          <select
            className="select"
            value={filters.in_stock}
            onChange={(event) => updateFilter('in_stock', event.target.value)}
          >
            <option value="">Any stock status</option>
            <option value="1">In stock only</option>
          </select>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setSearchParams({})}
          >
            Clear filters
          </button>
        </div>
      </section>

      {loading ? <div className="notice">Loading products...</div> : null}

      <section className="grid products">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>

      {!loading && products.length === 0 ? (
        <section className="notice">
          No products matched the current filters.{' '}
          <Link to="/products">Reset the search</Link>.
        </section>
      ) : null}

      {meta ? (
        <section className="toolbar">
          <p className="muted">
            Showing page {meta.current_page} of {meta.last_page}
          </p>
        </section>
      ) : null}
    </div>
  )
}

export default ProductsPage