import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'

const WISHLIST_VIEW_OPTIONS = [
  { value: 'list', columns: 1, iconCells: 3, kind: 'list', label: 'List' },
  { value: 'grid2', columns: 2, iconCells: 4, kind: 'grid', label: 'Grid 2' },
  { value: 'grid3', columns: 3, iconCells: 6, kind: 'grid', label: 'Grid 3' },
  { value: 'grid4', columns: 4, iconCells: 8, kind: 'grid', label: 'Grid 4' },
]

function WishlistPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [clearing, setClearing] = useState(false)
  const { items, clearWishlist } = useWishlist()
  const itemLabel = items.length === 1 ? 'product' : 'products'
  const viewModeParam = searchParams.get('view') ?? 'grid2'
  const viewMode = viewModeParam === 'grid5' ? 'grid4' : viewModeParam
  const [isMobileGridView, setIsMobileGridView] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia('(max-width: 900px)').matches
  })

  const effectiveViewMode = isMobileGridView && (viewMode === 'grid3' || viewMode === 'grid4')
    ? 'grid2'
    : viewMode

  const availableViewOptions = isMobileGridView
    ? WISHLIST_VIEW_OPTIONS.filter((option) => option.value !== 'grid3' && option.value !== 'grid4')
    : WISHLIST_VIEW_OPTIONS

  const selectedView = WISHLIST_VIEW_OPTIONS.find((option) => option.value === effectiveViewMode) ?? WISHLIST_VIEW_OPTIONS[1]
  const isRowView = selectedView.value === 'list'
  const productListClassName = isRowView
    ? 'catalog-product-list'
    : `catalog-product-grid catalog-product-grid--${selectedView.columns}`

  function setViewMode(nextMode) {
    const next = new URLSearchParams(searchParams)

    if (!nextMode || nextMode === 'grid2') {
      next.delete('view')
    } else {
      next.set('view', nextMode)
    }

    setSearchParams(next)
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(max-width: 900px)')

    function handleViewportChange(event) {
      setIsMobileGridView(event.matches)
    }

    setIsMobileGridView(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleViewportChange)

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange)
    }
  }, [])

  async function handleClearWishlist() {
    if (clearing || items.length === 0) {
      return
    }

    setClearing(true)

    try {
      await clearWishlist()
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Saved"
        title="Wishlist"
        description="Keep track of XETA products you want to buy next."
        action={items.length > 0 ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={handleClearWishlist}
            disabled={clearing}
          >
            {clearing ? 'Clearing...' : 'Clear wishlist'}
          </button>
        ) : null}
      />

      <section className="catalog-toolbar wishlist-toolbar">
        <p className="muted catalog-toolbar-count">
          {items.length} saved {itemLabel}
        </p>

        <div className="catalog-toolbar-controls">
          <div className="catalog-view-picker" role="group" aria-label="Wishlist view options">
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
        </div>
      </section>

      {items.length === 0 ? (
        <section className="notice">
          Your wishlist is empty. Browse the{' '}
          <Link to="/products">catalog</Link>{' '}
          and tap the heart icon to save products.
        </section>
      ) : (
        <section className={productListClassName}>
          {items.map((product, index) => (
            <ProductCard
              key={product.id ?? product.slug}
              product={product}
              prioritizeImage={index < 2}
              imageFetchPriority={index === 0 ? 'high' : 'auto'}
              layout={isRowView ? 'row' : 'card'}
              showDescription={selectedView.columns <= 2 && !isMobileGridView}
              uniformCardDesign={selectedView.columns >= 3}
            />
          ))}
        </section>
      )}
    </div>
  )
}

export default WishlistPage
