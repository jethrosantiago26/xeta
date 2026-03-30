import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { getProduct, readResource } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { getVariantVisual } from '../lib/variantVisuals.js'

function ProductDetailPage() {
  const { slug } = useParams()
  const { addItem } = useCart()
  const [product, setProduct] = useState(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let active = true

    async function loadProduct() {
      setLoading(true)

      try {
        const response = await getProduct(slug)
        const payload = readResource(response)
        const productData = payload.data ?? payload

        if (active) {
          setProduct(productData)
          setSelectedVariantId(String(productData?.variants?.[0]?.id ?? ''))
        }
      } catch (error) {
        if (active) {
          setProduct(null)
          setSelectedVariantId('')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadProduct()

    return () => {
      active = false
    }
  }, [slug])

  const visualVariants = useMemo(() => {
    return (product?.variants ?? []).map((variant, index) => ({
      ...variant,
      visual: getVariantVisual(variant, {
        index,
        productName: product?.name,
      }),
    }))
  }, [product])

  const selectedVariant = useMemo(() => {
    return visualVariants.find((variant) => String(variant.id) === selectedVariantId)
      ?? visualVariants[0]
      ?? null
  }, [visualVariants, selectedVariantId])

  if (loading) {
    return (
      <div className="page-grid">
        <section className="content-card">
          <p className="notice">Loading product...</p>
        </section>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="page-grid">
        <section className="content-card">
          <h1>Product not found</h1>
          <p className="muted">The requested product could not be loaded.</p>
          <Link className="button button-primary" to="/products">
            Back to products
          </Link>
        </section>
      </div>
    )
  }

  const image = selectedVariant?.visual?.image || product.primary_image || product.images?.[0]?.url || '/vite.svg'
  const price = selectedVariant?.price ?? product.lowest_price ?? 0

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div className="hero-media">
          <img src={image} alt={product.name} />
        </div>

        <div className="stack">
          <p className="eyebrow">{product.category?.name ?? 'Peripheral'}</p>
          <h1>{product.name}</h1>
          <p className="lede">{product.description}</p>
          <div className="row">
            <span className="price">{formatMoney(price)}</span>
            {product.average_rating ? (
              <span className="status-pill">{Number(product.average_rating).toFixed(1)} / 5</span>
            ) : null}
            {product.review_count ? (
              <span className="status-pill warning">{product.review_count} reviews</span>
            ) : null}
          </div>

          <div className="stack variant-selector">
            <p className="muted variant-selector-label">Variant finish</p>
            <div className="variant-meatballs" role="radiogroup" aria-label="Choose product variant">
              {visualVariants.map((variant) => {
                const isActive = String(variant.id) === String(selectedVariant?.id ?? '')

                return (
                  <button
                    key={variant.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-label={`${variant.name} ${formatMoney(variant.price)}`}
                    className={`variant-meatball${isActive ? ' active' : ''}`}
                    style={{
                      '--variant-color': variant.visual.color,
                      '--variant-ring': variant.visual.ringColor,
                      '--variant-ink': variant.visual.textColor,
                    }}
                    onClick={() => setSelectedVariantId(String(variant.id))}
                  />
                )
              })}
            </div>
            {selectedVariant ? (
              <div className="variant-selection-summary">
                <span>{selectedVariant.name}</span>
                <span>{formatMoney(selectedVariant.price)}</span>
              </div>
            ) : null}
          </div>

          {selectedVariant ? (
            <p className="muted" style={{ margin: 0 }}>
              Selected: {selectedVariant.name}
            </p>
          ) : null}

          {actionError ? <div className="notice error">{actionError}</div> : null}
          {actionMessage ? <div className="notice success">{actionMessage}</div> : null}

          <div className="actions">
            <button
              type="button"
              className="button button-primary"
              disabled={!selectedVariant}
              onClick={async () => {
                if (!selectedVariant) {
                  return
                }

                setAdding(true)
                setActionError('')
                setActionMessage('')

                try {
                  await addItem(selectedVariant.id, 1)
                  setActionMessage('Added to cart.')
                } catch (error) {
                  setActionError('Sign in first to add this item to your cart.')
                } finally {
                  setAdding(false)
                }
              }}
            >
              {adding ? 'Adding...' : 'Add to cart'}
            </button>
            <Link className="button button-secondary" to="/cart">
              Go to cart
            </Link>
          </div>
        </div>
      </section>

      <section className="grid cards">
        <div className="summary-card">
          <h3>Specs</h3>
          <div className="divider" />
          <pre className="muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {JSON.stringify(product.specs ?? {}, null, 2)}
          </pre>
        </div>
        <div className="summary-card">
          <h3>Variants</h3>
          <div className="divider" />
          <div className="stack">
            {visualVariants.map((variant) => (
              <div key={variant.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{variant.name}</span>
                <span>{formatMoney(variant.price)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default ProductDetailPage