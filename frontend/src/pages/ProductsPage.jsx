import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PriceSlider from '../components/PriceSlider.jsx'
import { getCategories, getProducts, readResource } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'

const REFRESH_INTERVAL_MS = 15000
const SEARCH_DEBOUNCE_MS = 350
const DEFAULT_PRICE_BOUNDS = { min: 0, max: 0 }
const VIEW_OPTIONS = [
  { value: 'list', columns: 1, iconCells: 3, kind: 'list', label: 'List' },
  { value: 'grid2', columns: 2, iconCells: 4, kind: 'grid', label: 'Grid 2' },
  { value: 'grid3', columns: 3, iconCells: 6, kind: 'grid', label: 'Grid 3' },
  { value: 'grid4', columns: 4, iconCells: 8, kind: 'grid', label: 'Grid 4' },
]

function parseCategoryFilters(params) {
  const categoriesRaw = params.get('categories')

  const categories = (categoriesRaw ? categoriesRaw.split(',') : [])
    .map((slug) => slug.trim())
    .filter(Boolean)

  if (categories.length > 0) {
    return Array.from(new Set(categories))
  }

  const legacyCategory = (params.get('category') ?? '').trim()

  return legacyCategory ? [legacyCategory] : []
}

function normalizePriceBounds(meta, products = []) {
  const metaMin = Number(meta?.price_bounds?.min)
  const metaMax = Number(meta?.price_bounds?.max)

  if (Number.isFinite(metaMin) && Number.isFinite(metaMax) && metaMax >= metaMin) {
    return {
      min: Math.max(0, Math.floor(metaMin)),
      max: Math.max(0, Math.ceil(metaMax)),
    }
  }

  const prices = products
    .flatMap((product) => [
      Number(product.lowest_sale_price ?? product.lowest_price),
      ...(product.variants ?? []).map((variant) => Number(variant.sale_price ?? variant.price)),
    ])
    .filter((price) => Number.isFinite(price) && price >= 0)

  if (!prices.length) {
    return DEFAULT_PRICE_BOUNDS
  }

  return {
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
  }
}

function clampPriceInput(value, bounds) {
  if (value === '' || value == null) return ''

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''

  const clamped = Math.max(bounds.min, Math.min(numericValue, bounds.max))
  return String(Math.round(clamped))
}

function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [meta, setMeta] = useState(null)
  const [priceBounds, setPriceBounds] = useState(DEFAULT_PRICE_BOUNDS)
  const [boundsReady, setBoundsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  // Local state for the search input — decoupled from the URL so typing
  // doesn't fire a request on every keystroke.
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') ?? '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') ?? '')

  const selectedCategorySlugs = useMemo(() => parseCategoryFilters(searchParams), [searchParams])

  const filters = {
    search: searchParams.get('search') ?? '',
    sort: searchParams.get('sort') ?? 'latest',
    min_price: searchParams.get('min_price') ?? '',
    max_price: searchParams.get('max_price') ?? '',
    in_stock: searchParams.get('in_stock') ?? '',
    stock_view: searchParams.get('stock_view') ?? '',
  }

  const perPage = Math.max(6, Number(searchParams.get('per_page') || 12) || 12)
  const viewModeParam = searchParams.get('view') ?? 'grid2'
  const viewMode = viewModeParam === 'grid5' ? 'grid4' : viewModeParam
  const [isMobileGridView, setIsMobileGridView] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia('(max-width: 768px)').matches
  })

  const effectiveViewMode = isMobileGridView && (viewMode === 'grid3' || viewMode === 'grid4')
    ? 'grid2'
    : viewMode

  const availableViewOptions = isMobileGridView
    ? VIEW_OPTIONS.filter((option) => option.value !== 'grid3' && option.value !== 'grid4')
    : VIEW_OPTIONS

  const requestFilters = useMemo(() => {
    return {
      search: filters.search,
      categories: selectedCategorySlugs.length > 0 ? selectedCategorySlugs.join(',') : '',
      sort: filters.sort,
      min_price: filters.min_price,
      max_price: filters.max_price,
      in_stock: filters.in_stock,
      stock_view: filters.stock_view,
      per_page: perPage,
    }
  }, [
    filters.search,
    filters.sort,
    filters.min_price,
    filters.max_price,
    filters.in_stock,
    filters.stock_view,
    perPage,
    selectedCategorySlugs,
  ])

  // Debounce the search input → URL param update
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (searchInput.trim()) {
        next.set('search', searchInput.trim())
      } else {
        next.delete('search')
      }

      if (minPrice !== '') next.set('min_price', minPrice)
      else next.delete('min_price')

      if (maxPrice !== '') next.set('max_price', maxPrice)
      else next.delete('max_price')

      // Only push to URL if the value actually changed
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchInput, minPrice, maxPrice, searchParams, setSearchParams])

  // Keep the local search input in sync if the URL is updated externally
  // (e.g., browser back/forward, or "Clear filters" button).
  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? ''
    const urlMin = searchParams.get('min_price') ?? ''
    const urlMax = searchParams.get('max_price') ?? ''

    setSearchInput((prev) => (prev === urlSearch ? prev : urlSearch))
    setMinPrice((prev) => (prev === urlMin ? prev : urlMin))
    setMaxPrice((prev) => (prev === urlMax ? prev : urlMax))
  }, [searchParams])

  useEffect(() => {
    if (!boundsReady) {
      return
    }

    if (priceBounds.max < priceBounds.min) {
      return
    }

    let normalizedMin = clampPriceInput(minPrice, priceBounds)
    let normalizedMax = clampPriceInput(maxPrice, priceBounds)

    if (
      normalizedMin !== ''
      && normalizedMax !== ''
      && Number(normalizedMin) > Number(normalizedMax)
    ) {
      normalizedMax = normalizedMin
    }

    if (normalizedMin !== minPrice) {
      setMinPrice(normalizedMin)
    }

    if (normalizedMax !== maxPrice) {
      setMaxPrice(normalizedMax)
    }
  }, [boundsReady, priceBounds, minPrice, maxPrice])

  const loadProducts = useCallback(async ({ signal, background = false } = {}) => {
    if (!background) {
      setLoading(true)
    }

    try {
      const productsResponse = await getProducts(
        {
          ...Object.fromEntries(
            Object.entries(requestFilters).filter(([, value]) => value !== ''),
          ),
        },
        signal,
      )

      const productPayload = readResource(productsResponse)
      const nextPriceBounds = normalizePriceBounds(productPayload.meta, productPayload.data ?? [])

      setProducts(productPayload.data ?? [])
      setMeta(productPayload.meta ?? null)
      setPriceBounds(nextPriceBounds)
      setBoundsReady(true)
    } catch (err) {
      // Ignore abort errors — they are intentional cancellations.
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError') {
        return
      }
      if (!background) {
        setProducts([])
        setMeta(null)
        setPriceBounds(DEFAULT_PRICE_BOUNDS)
        setBoundsReady(false)
      }
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, [requestFilters])

  useEffect(() => {
    let active = true

    if (categories.length > 0) {
      return () => {
        active = false
      }
    }

    getCategories()
      .then((categoriesResponse) => {
        if (!active) {
          return
        }

        const categoryPayload = readResource(categoriesResponse)
        setCategories(categoryPayload.data ?? [])
      })
      .catch(() => {
        if (!active) {
          return
        }

        setCategories([])
      })

    return () => {
      active = false
    }
  }, [categories.length])

  useEffect(() => {
    // Create a new AbortController for each effect run so the previous
    // request is cancelled before the next one fires.
    const controller = new AbortController()

    loadProducts({ signal: controller.signal })

    const refreshVisibleData = () => {
      if (document.hidden) return
      loadProducts({ signal: controller.signal, background: true })
    }

    const intervalId = window.setInterval(refreshVisibleData, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshVisibleData)

    return () => {
      controller.abort()
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

  function clearFilters() {
    const next = new URLSearchParams(searchParams)

    next.delete('search')
    next.delete('category')
    next.delete('categories')
    next.delete('min_price')
    next.delete('max_price')
    next.delete('in_stock')
    next.delete('stock_view')

    setSearchInput('')
    setMinPrice('')
    setMaxPrice('')
    setSearchParams(next)
  }

  function applyPriceFilters() {
    const next = new URLSearchParams(searchParams)

    if (minPrice !== '') next.set('min_price', minPrice)
    else next.delete('min_price')

    if (maxPrice !== '') next.set('max_price', maxPrice)
    else next.delete('max_price')

    setSearchParams(next)
  }

  function setInStockFilter(checked) {
    const next = new URLSearchParams(searchParams)
    const outOfStockSelected = searchParams.get('stock_view') === 'out'

    if (checked) {
      if (outOfStockSelected) {
        next.delete('in_stock')
        next.delete('stock_view')
      } else {
        next.set('in_stock', '1')
      }
    } else {
      next.delete('in_stock')
    }

    setSearchParams(next)
  }

  function setOutOfStockView(checked) {
    const next = new URLSearchParams(searchParams)
    const inStockSelected = searchParams.get('in_stock') === '1'

    if (checked) {
      if (inStockSelected) {
        next.delete('in_stock')
        next.delete('stock_view')
      } else {
        next.set('stock_view', 'out')
      }
    } else {
      next.delete('stock_view')
    }

    setSearchParams(next)
  }

  function toggleCategoryFilter(categorySlug, checked) {
    const next = new URLSearchParams(searchParams)
    const currentCategories = parseCategoryFilters(searchParams)
    const availableCategorySlugs = categories
      .map((category) => category.slug)
      .filter(Boolean)

    const nextCategories = checked
      ? Array.from(new Set([...currentCategories, categorySlug]))
      : currentCategories.filter((slug) => slug !== categorySlug)

    // Prefer the multi-value key going forward and clear legacy single key.
    next.delete('category')

    const shouldClearCategories = availableCategorySlugs.length > 0
      && nextCategories.length >= availableCategorySlugs.length
      && availableCategorySlugs.every((slug) => nextCategories.includes(slug))

    if (nextCategories.length > 0 && !shouldClearCategories) {
      next.set('categories', nextCategories.join(','))
    } else {
      next.delete('categories')
    }

    setSearchParams(next)
  }

  function setViewMode(nextMode) {
    const next = new URLSearchParams(searchParams)

    if (!nextMode || nextMode === 'grid2') {
      next.delete('view')
    } else {
      next.set('view', nextMode)
    }

    setSearchParams(next)
  }

  function openMobileFilters() {
    setIsMobileFilterOpen(true)
  }

  function closeMobileFilters() {
    setIsMobileFilterOpen(false)
  }

  function clearAndCloseMobileFilters() {
    clearFilters()
    setIsMobileFilterOpen(false)
  }

  function applyAndCloseMobileFilters() {
    applyPriceFilters()
    setIsMobileFilterOpen(false)
  }

  const productsWithStockState = useMemo(() => {
    return products.map((product) => {
      const hasStock = (product.variants ?? []).some((variant) => Number(variant.stock_quantity ?? 0) > 0)

      return {
        ...product,
        hasStock,
      }
    })
  }, [products])

  const stockCounts = useMemo(() => {
    const metaInStock = Number(meta?.stock_counts?.in_stock)
    const metaOutOfStock = Number(meta?.stock_counts?.out_of_stock)

    if (Number.isFinite(metaInStock) && Number.isFinite(metaOutOfStock)) {
      return {
        inStock: metaInStock,
        outOfStock: metaOutOfStock,
      }
    }

    let inStock = 0
    let outOfStock = 0

    for (const product of productsWithStockState) {
      if (product.hasStock) {
        inStock += 1
      } else {
        outOfStock += 1
      }
    }

    return { inStock, outOfStock }
  }, [meta?.stock_counts?.in_stock, meta?.stock_counts?.out_of_stock, productsWithStockState])

  const displayedProducts = productsWithStockState

  const selectedPerPage = String(perPage)
  const selectedView = VIEW_OPTIONS.find((option) => option.value === effectiveViewMode) ?? VIEW_OPTIONS[1]
  const isRowView = selectedView.value === 'list'
  const productListClassName = isRowView
    ? 'catalog-product-list'
    : `catalog-product-grid catalog-product-grid--${selectedView.columns}`
  const toolbarSummaryText = meta?.total
    ? `Showing ${displayedProducts.length} of ${meta.total} items`
    : `Showing ${displayedProducts.length} item${displayedProducts.length === 1 ? '' : 's'}`
  const activeFilterCount = (
    (filters.search ? 1 : 0)
    + (filters.min_price ? 1 : 0)
    + (filters.max_price ? 1 : 0)
    + (filters.in_stock === '1' ? 1 : 0)
    + (filters.stock_view === 'out' ? 1 : 0)
    + selectedCategorySlugs.length
  )

  const hasValidBounds = priceBounds.max >= priceBounds.min && (priceBounds.max > 0 || priceBounds.min > 0)

  useEffect(() => {
    if (!isMobileFilterOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsMobileFilterOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileFilterOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(max-width: 768px)')

    function handleViewportChange(event) {
      setIsMobileGridView(event.matches)
    }

    setIsMobileGridView(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleViewportChange)

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange)
    }
  }, [])

  function renderFilters({ mobile = false } = {}) {
    return (
      <>
        <label className="catalog-filter-field">
          <span className="catalog-filter-label">Search</span>
          <input
            className="input"
            placeholder="Search products"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <div className="catalog-filter-group">
          <h3>Availability</h3>
          <label className="catalog-checkbox-row">
            <input
              type="checkbox"
              checked={filters.in_stock === '1'}
              onChange={(event) => setInStockFilter(event.target.checked)}
            />
            <span>In stock ({stockCounts.inStock})</span>
          </label>
          <label className="catalog-checkbox-row">
            <input
              type="checkbox"
              checked={filters.stock_view === 'out'}
              onChange={(event) => setOutOfStockView(event.target.checked)}
            />
            <span>Out of stock ({stockCounts.outOfStock})</span>
          </label>
        </div>

        <div className="catalog-filter-group">
          <h3>Price</h3>
          <PriceSlider
            minPrice={minPrice}
            maxPrice={maxPrice}
            setMinPrice={setMinPrice}
            setMaxPrice={setMaxPrice}
            boundsMin={priceBounds.min}
            boundsMax={priceBounds.max}
            step={50}
          />
          <div className="catalog-price-inputs">
            <label className="catalog-filter-field">
              <span className="catalog-filter-label">Min</span>
              <input
                className="input"
                type="number"
                min={priceBounds.min}
                max={priceBounds.max}
                step={50}
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
              />
            </label>
            <label className="catalog-filter-field">
              <span className="catalog-filter-label">Max</span>
              <input
                className="input"
                type="number"
                min={priceBounds.min}
                max={priceBounds.max}
                step={50}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </label>
          </div>
          <p className="products-price-caption">
            {hasValidBounds
              ? `Price limits: ${formatMoney(priceBounds.min)} to ${formatMoney(priceBounds.max)}`
              : 'Price limits update as products load.'}
          </p>
          {!mobile ? (
            <button type="button" className="button button-primary catalog-apply-button" onClick={applyPriceFilters}>
              Apply
            </button>
          ) : null}
        </div>

        <div className="catalog-filter-group">
          <h3>Product type</h3>
          <div className="catalog-checkbox-list">
            {categories.map((category) => {
              const isChecked = selectedCategorySlugs.includes(category.slug)

              return (
                <label key={category.id} className="catalog-checkbox-row">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(event) => {
                      toggleCategoryFilter(category.slug, event.target.checked)
                    }}
                  />
                  <span>{category.name} ({category.products_count ?? 0})</span>
                </label>
              )
            })}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Filter peripherals by price, stock, and category."
      />

      <div className="catalog-layout">
        <aside className="catalog-sidebar catalog-sidebar-desktop">
          <section className="filter-panel catalog-sidebar-panel">
            <div className="catalog-sidebar-head">
              <h2>Filters</h2>
              <button
                type="button"
                className="button button-secondary catalog-clear-button"
                onClick={clearFilters}
              >
                Clear
              </button>
            </div>

            {renderFilters()}
          </section>
        </aside>

        <main className="catalog-main">
          <section className="catalog-toolbar">
            <p className="muted catalog-toolbar-count">
              {toolbarSummaryText}
            </p>

            <div className="catalog-toolbar-controls">
              <div className="catalog-mobile-controls">
                <button
                  type="button"
                  className="button button-secondary catalog-mobile-filter-button"
                  onClick={openMobileFilters}
                >
                  Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>

                <label className="catalog-mobile-sort-field">
                  <span className="catalog-toolbar-field-label">Sort by</span>
                  <select
                    className="select"
                    value={filters.sort}
                    onChange={(event) => updateFilter('sort', event.target.value)}
                  >
                    <option value="latest">Newest</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                  </select>
                </label>
              </div>

              <div className="catalog-view-picker" role="group" aria-label="View options">
                <span className="catalog-view-label">View as</span>
                <div className="catalog-view-options">
                  {availableViewOptions.map((option) => {
                    const isActive = option.value === selectedView.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`catalog-view-button${isActive ? ' active' : ''}`}
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => setViewMode(option.value)}
                      >
                        <span
                          className={`catalog-view-icon ${option.kind === 'list' ? 'is-list' : 'is-grid'}`}
                          style={option.kind === 'grid' ? { '--view-cols': String(option.columns) } : undefined}
                        >
                          {Array.from({ length: option.iconCells }).map((_, index) => (
                            <span key={`${option.value}-${index}`} />
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="catalog-toolbar-field catalog-toolbar-field--per-page">
                <span className="catalog-toolbar-field-label">Items per page</span>
                <select
                  className="select"
                  value={selectedPerPage}
                  onChange={(event) => updateFilter('per_page', event.target.value)}
                >
                  <option value="12">12</option>
                  <option value="24">24</option>
                  <option value="36">36</option>
                </select>
              </label>

              <label className="catalog-toolbar-field catalog-toolbar-field--sort">
                <span className="catalog-toolbar-field-label">Sort by</span>
                <select
                  className="select"
                  value={filters.sort}
                  onChange={(event) => updateFilter('sort', event.target.value)}
                >
                  <option value="latest">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="name_asc">Name: A to Z</option>
                  <option value="name_desc">Name: Z to A</option>
                </select>
              </label>
            </div>
          </section>

          {loading ? <div className="notice">Loading products...</div> : null}

          <section className={productListClassName}>
            {displayedProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                prioritizeImage={index < 2}
                imageFetchPriority={index === 0 ? 'high' : 'auto'}
                layout={isRowView ? 'row' : 'card'}
                showDescription={selectedView.columns <= 2 && !isMobileGridView}
                uniformCardDesign={selectedView.columns >= 3}
              />
            ))}
          </section>

          {!loading && displayedProducts.length === 0 ? (
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
        </main>
      </div>

      {isMobileFilterOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="catalog-mobile-filter-backdrop open"
            onClick={closeMobileFilters}
            aria-hidden="false"
          >
            <section
              className="filter-panel catalog-mobile-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Filter products"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="catalog-mobile-filter-head">
                <h2>Filters</h2>
                <button type="button" className="button button-secondary" onClick={closeMobileFilters}>Close</button>
              </header>

              <div className="catalog-mobile-filter-body">
                {renderFilters({ mobile: true })}
              </div>

              <footer className="catalog-mobile-filter-footer">
                <button type="button" className="button button-secondary" onClick={clearAndCloseMobileFilters}>
                  Clear
                </button>
                <button type="button" className="button button-primary" onClick={applyAndCloseMobileFilters}>
                  Show results
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )
        : null}
    </div>
  )
}

export default ProductsPage
