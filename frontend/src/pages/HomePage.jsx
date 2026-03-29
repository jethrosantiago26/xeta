import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { getCategories, getProducts, readResource } from '../lib/api.js'

const TABS = ['Top Gears', 'Best Sellers', 'New Releases']

function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [activeTab, setActiveTab] = useState('Top Gears')

  useEffect(() => {
    let active = true

    async function loadHomeData() {
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          getProducts({ per_page: 6, sort: 'latest' }),
          getCategories(),
        ])

        const productsPayload = readResource(productsResponse)
        const categoriesPayload = readResource(categoriesResponse)

        if (active) {
          setFeaturedProducts(productsPayload.data ?? [])
          setCategories(categoriesPayload.data ?? [])
        }
      } catch {
        if (active) {
          setFeaturedProducts([])
          setCategories([])
        }
      }
    }

    loadHomeData()

    return () => {
      active = false
    }
  }, [])

  const heroProduct = featuredProducts[0]
  const trendingProducts = featuredProducts.slice(0, 5)

  return (
    <div className="page-grid">

      {/* ── HERO — full-bleed dark like PDF slides 1–4 ── */}
      <section className="hero-panel home-hero">
        <div className="hero-copy">
          <span className="hero-tag">Designed for serious desks</span>
          <div className="stack">
            <h1>Peripheral systems with a quieter kind of confidence.</h1>
            <p className="lede">
              XETA pairs Clerk authentication, a Laravel-backed commerce flow,
              and a cash on delivery checkout with an editorial storefront that
              keeps the focus on the products.
            </p>
          </div>

          <div className="hero-meta">
            <div className="hero-strap">
              <span className="status-pill">Cash on delivery</span>
              <span className="status-pill warning">Limited inventory drops</span>
              <span className="chip">Precision keyboards</span>
              <span className="chip">Gaming mice</span>
            </div>
          </div>

          <div className="actions">
            <Link className="button button-primary" to="/products">
              Explore the catalog
            </Link>
            <Link className="button button-secondary" to="/checkout">
              Continue to checkout
            </Link>
          </div>

          <div className="metric-strip">
            <div className="metric-card">
              <strong>{categories.length || '—'}</strong>
              <p className="muted">Categories</p>
            </div>
            <div className="metric-card">
              <strong>{featuredProducts.length || '—'}</strong>
              <p className="muted">Products loaded</p>
            </div>
            <div className="metric-card">
              <strong>COD</strong>
              <p className="muted">Pay at delivery</p>
            </div>
          </div>
        </div>

        <aside className="hero-visual">
          <div className="hero-frame">
            {heroProduct ? (
              <img
                src={heroProduct.primary_image || heroProduct.images?.[0]?.url || '/vite.svg'}
                alt={heroProduct.name}
              />
            ) : (
              <div className="hero-annotation" style={{ minHeight: '240px', display: 'grid', alignContent: 'center' }}>
                <p className="kicker">Featured drop</p>
                <h3 className="hero-title">New arrivals appear here.</h3>
                <p className="muted">
                  The home screen is ready for product imagery once inventory is live.
                </p>
              </div>
            )}
          </div>

          <div className="hero-annotation">
            <p className="kicker">Built for clarity</p>
            <h3 className="hero-title">A storefront that reads like a product catalog.</h3>
            <p className="muted">
              No payment clutter, no noisy banners. Structure is intentionally minimal
              so the image, pricing, and product name do the work.
            </p>
          </div>
        </aside>
      </section>

      {/* ── TRENDING CONTENT — tab row matching PDF ── */}
      <section className="content-card">
        <div style={{ marginBottom: '4px' }}>
          <p className="eyebrow-inline">Trending Content</p>
        </div>

        {/* Tab row — exactly like PDF "Top Gears / Best Sellers / New Releases" */}
        <div className="tab-row">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-btn${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div
          className="grid products"
          style={{ marginTop: '4px', animation: 'fadeUp 0.35s cubic-bezier(0,0,0.2,1) both' }}
          key={activeTab}
        >
          {trendingProducts.length > 0
            ? trendingProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="product-card" style={{ minHeight: '280px' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }} />
                  <div className="stack" style={{ marginTop: '14px', gap: '8px' }}>
                    <div style={{ height: '10px', width: '60%', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ height: '14px', width: '80%', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ height: '10px', width: '40%', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }} />
                  </div>
                </div>
              ))}
        </div>
      </section>

      {/* ── FEATURE ACCORDION SECTION — like PDF left panel ── */}
      <section className="content-card">
        <div className="section-label">
          <div>
            <p className="eyebrow-inline">Why XETA</p>
            <h2>Clean structure, fast routing, and a more considered retail feel.</h2>
          </div>
          <div className="section-rule" aria-hidden="true" />
        </div>

        <div className="feature-grid">
          {[
            { title: 'Next-Gen Hall Effect Technology', body: 'Magnetic switch technology provides unmatched precision with zero contact wear.' },
            { title: 'Rapid Trigger & Dynamic Actuation', body: 'Customize actuation points with sub-millisecond response for competitive play.' },
            { title: 'Exceptional Feel & Acoustic Engineering', body: 'Every keystroke is tuned for a premium tactile and acoustic experience.' },
            { title: 'Crafted to Perfection: All-Aluminum Build', body: 'Aircraft-grade aluminum construction built for endurance and premium aesthetics.' },
          ].map(({ title, body }) => (
            <article key={title} className="feature-card">
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── PHOTO GALLERY STRIP — "They are Just for You" from PDF ── */}
      <section className="content-card">
        <div className="section-label">
          <div>
            <p className="eyebrow-inline">Catalog notes</p>
            <h2>Built for desks that want to feel assembled, not decorated.</h2>
          </div>
          <div className="section-rule" aria-hidden="true" />
        </div>

        <p className="muted" style={{ marginBottom: '20px' }}>
          Browse categories, compare products, and move through checkout without
          losing the visual rhythm of the page.
        </p>

        <div className="closing-band">
          <div>
            <div className="category-cloud">
              {categories.slice(0, 6).map((category) => (
                <Link key={category.id} className="category-chip" to={`/products?category=${category.slug}`}>
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="actions">
            <Link className="button button-primary" to="/products">
              Browse all products
            </Link>
            <Link className="button button-secondary" to="/cart">
              View cart
            </Link>
          </div>
        </div>
      </section>

      {featuredProducts.length === 0 ? (
        <section className="notice">
          No products loaded yet. Add inventory to fill the catalog.
        </section>
      ) : null}
    </div>
  )
}

export default HomePage