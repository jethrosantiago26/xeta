import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getProduct,
  getProducts,
  readResource,
} from '../lib/api.js'
import { formatMoney } from '../lib/format.js'
import { normalizeDisplayText, resolveProductImage } from '../lib/orderItemMedia.js'
import './HomePage.css'

const TRENDING_TABS = [
  { value: 'top-gears', label: 'Top Gears' },
  { value: 'best-sellers', label: 'Best Sellers' },
  { value: 'new-releases', label: 'New Releases' },
]

const HERO_BANNERS = [
  '/images/gemini-landing.png',
  '/images/gemini-banner-secondary.png',
]

const TECH_FEATURES = [
  {
    title: 'Adjustable Actuation',
    description: 'Customize response points for fast peeks, quick strafes, and cleaner movement control.',
  },
  {
    title: 'Rapid Trigger Ready',
    description: 'Dynamic key travel sensing keeps inputs immediate during high-pressure competitive rounds.',
  },
  {
    title: 'Long-Term Durability',
    description: 'Precision components and strict QC keep switches crisp through long grind sessions.',
  },
]

function resolveImageUrl(product) {
  const resolved = resolveProductImage(product, { fallbackImage: '' })
  return resolved || null
}

function sortByRating(left, right) {
  const leftRating = Number(left?.average_rating ?? 0)
  const rightRating = Number(right?.average_rating ?? 0)

  if (rightRating !== leftRating) {
    return rightRating - leftRating
  }

  return Number(right?.review_count ?? 0) - Number(left?.review_count ?? 0)
}

function sortByRecency(left, right) {
  return new Date(right?.created_at ?? 0).getTime() - new Date(left?.created_at ?? 0).getTime()
}

function resolveReviewPayload(payload) {
  if (!payload) {
    return null
  }

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }

  return payload
}

function HomePage() {
  const [products, setProducts] = useState([])
  const [testimonials, setTestimonials] = useState([])
  const [activeTab, setActiveTab] = useState(TRENDING_TABS[0].value)
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [activeInsightId, setActiveInsightId] = useState('switch-tech')
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadLandingData() {
      try {
        const productsResponse = await getProducts({ per_page: 12, sort: 'newest' })

        const productsPayload = readResource(productsResponse)

        const loadedProducts = Array.isArray(productsPayload?.data)
          ? productsPayload.data
          : []

        if (!mounted) {
          return
        }

        setProducts(loadedProducts)
        setLoadFailed(false)

        const testimonialCandidates = [...loadedProducts]
          .sort(sortByRating)
          .slice(0, 3)

        if (testimonialCandidates.length === 0) {
          setTestimonials([])
          return
        }

        const testimonialResults = await Promise.all(
          testimonialCandidates.map(async (candidate, index) => {
            try {
              const detailResponse = await getProduct(candidate.slug)
              const detailPayload = resolveReviewPayload(readResource(detailResponse))
              const productDetail = detailPayload || candidate
              const reviews = Array.isArray(productDetail?.reviews)
                ? productDetail.reviews
                : []
              const reviewWithComment = reviews.find(
                (review) => typeof review.comment === 'string' && review.comment.trim() !== '',
              )

              if (!reviewWithComment) {
                return null
              }

              const rating = Math.max(
                1,
                Math.min(5, Math.round(Number(reviewWithComment.rating ?? candidate.average_rating ?? 5))),
              )

              return {
                id: reviewWithComment.id || `review-${candidate.id}-${index}`,
                quote: `"${reviewWithComment.comment}"`,
                author: reviewWithComment.author_name || 'Verified Buyer',
                role: normalizeDisplayText(reviewWithComment.variant?.name)
                  || productDetail.category?.name
                  || 'XETA Customer',
                rating,
              }
            } catch {
              return null
            }
          }),
        )

        if (mounted) {
          setTestimonials(testimonialResults.filter(Boolean).slice(0, 3))
        }
      } catch {
        if (!mounted) {
          return
        }

        setProducts([])
        setTestimonials([])
        setLoadFailed(true)
      }
    }

    loadLandingData()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (HERO_BANNERS.length < 2) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % HERO_BANNERS.length)
    }, 6500)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const topGears = useMemo(() => [...products].sort(sortByRating), [products])
  const bestSellers = useMemo(
    () => [...products].sort((left, right) => Number(right.review_count ?? 0) - Number(left.review_count ?? 0)),
    [products],
  )
  const newReleases = useMemo(() => [...products].sort(sortByRecency), [products])

  const productsByTab = useMemo(
    () => ({
      'top-gears': topGears,
      'best-sellers': bestSellers,
      'new-releases': newReleases,
    }),
    [bestSellers, newReleases, topGears],
  )

  const activeTrendingProducts = (productsByTab[activeTab] || []).slice(0, 3)
  const technicalSpotlightImage = resolveImageUrl(topGears[1] || topGears[0])
  const featureShowcaseProduct = topGears.find((product) => Boolean(resolveImageUrl(product)))
    || bestSellers.find((product) => Boolean(resolveImageUrl(product)))
    || newReleases.find((product) => Boolean(resolveImageUrl(product)))
    || null
  const featureShowcaseImage = resolveImageUrl(featureShowcaseProduct)
  const featureShowcasePrice = Number(featureShowcaseProduct?.lowest_price ?? featureShowcaseProduct?.variants?.[0]?.price ?? 0)
  const featureShowcaseName = normalizeDisplayText(featureShowcaseProduct?.name || 'XETA flagship')

  const featureInsights = useMemo(
    () => [
      {
        id: 'switch-tech',
        title: 'Next-Gen Magnetic Switch Technology (Hall Effect)',
        lead: `Unrivaled precision with ${featureShowcaseName} calibration`,
        description: `Built for consistency in fast matches with tight actuation control and dependable trigger response at ${featureShowcasePrice > 0 ? formatMoney(featureShowcasePrice) : 'competitive'} pricing.`,
      },
      {
        id: 'rapid-trigger',
        title: 'Rapid Trigger & Dynamic Actuation',
        lead: 'Responsive release tracking with cleaner counter-strafes',
        description: 'Rapid trigger behavior is tuned for competitive pacing so movement and click timing stay sharp under pressure.',
      },
      {
        id: 'acoustics',
        title: 'Exceptional Feel & Acoustic Engineering',
        lead: 'Balanced sound profile for long sessions',
        description: 'Layered internal damping and structural control deliver a refined key feel and less harsh resonance on repeated input.',
      },
      {
        id: 'build',
        title: 'Crafted To Perfection: All-Aluminum Build',
        lead: 'Rigid chassis designed for stability',
        description: 'Precision-machined metal housings improve typing stability, reduce flex, and keep the board grounded during heavy use.',
      },
      {
        id: 'software',
        title: 'XETA HUB & RGB Customization',
        lead: 'Control profiles without clutter',
        description: 'Create profiles for play and work, tune per-key behavior, and save settings for quick switching across setups.',
      },
    ],
    [featureShowcaseName, featureShowcasePrice],
  )

  const reviewCards = testimonials

  return (
    <div className="landing-home">
      <section className="landing-hero" aria-label="Featured products banner">
        <div className="landing-hero-slides" aria-hidden="true">
          {HERO_BANNERS.map((imagePath, index) => (
            <div
              key={imagePath}
              className={`landing-hero-slide${index === activeBannerIndex ? ' active' : ''}`}
              style={{ backgroundImage: `url(${imagePath})` }}
            />
          ))}
        </div>
        <div className="landing-hero-overlay" />

        {HERO_BANNERS.length > 1 ? (
          <>
            <div className="landing-hero-indicators" role="tablist" aria-label="Banner slides">
              {HERO_BANNERS.map((imagePath, index) => (
                <button
                  key={`indicator-${imagePath}`}
                  type="button"
                  className={index === activeBannerIndex ? 'active' : ''}
                  onClick={() => setActiveBannerIndex(index)}
                  aria-label={`Show banner ${index + 1}`}
                  aria-selected={index === activeBannerIndex}
                  role="tab"
                />
              ))}
            </div>

            <div className="landing-hero-nav" aria-label="Banner navigation">
              <button
                type="button"
                className="landing-hero-nav-button"
                onClick={() => {
                  setActiveBannerIndex((current) => (current - 1 + HERO_BANNERS.length) % HERO_BANNERS.length)
                }}
                aria-label="Previous banner"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="landing-hero-nav-button"
                onClick={() => {
                  setActiveBannerIndex((current) => (current + 1) % HERO_BANNERS.length)
                }}
                aria-label="Next banner"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M9.5 6 15.5 12l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="landing-section landing-section-surface" aria-labelledby="trending-title">
        <div className="landing-container">
          <div className="landing-section-header">
            <div>
              <h2 id="trending-title">Trending Gear</h2>
              <p>Curated from live product inventory and shopper activity.</p>
            </div>
            <Link to="/products" className="landing-section-link">
              View All Collection
            </Link>
          </div>

          <div className="landing-tab-row" role="tablist" aria-label="Trending categories">
            {TRENDING_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                className={activeTab === tab.value ? 'active' : ''}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="landing-product-grid" key={activeTab}>
            {activeTrendingProducts.length > 0 ? (
              activeTrendingProducts.map((product) => {
                const price = Number(product.lowest_price ?? product.variants?.[0]?.price ?? 0)
                const compareAtPrice = Number(product.variants?.[0]?.compare_at_price ?? 0)
                const imageUrl = resolveImageUrl(product)
                const productName = normalizeDisplayText(product.name)
                const variantName = normalizeDisplayText(product.variants?.[0]?.name || 'Performance tuned variant')

                return (
                  <article key={product.id} className="landing-product-card">
                    <div className="landing-product-image-wrap">
                      {imageUrl ? (
                        <img src={imageUrl} alt={productName} loading="lazy" decoding="async" />
                      ) : (
                        <div className="landing-image-fallback" aria-hidden="true" />
                      )}
                      <span className="landing-product-badge">
                        {Number(product.average_rating ?? 0) >= 4.8
                          ? 'Elite Rated'
                          : Number(product.review_count ?? 0) >= 5
                            ? 'Community Pick'
                            : 'New Drop'}
                      </span>
                    </div>

                    <div className="landing-product-content">
                      <p>{product.category?.name || 'Peripherals'}</p>
                      <h3>{productName}</h3>
                      <small>{variantName}</small>

                      <div className="landing-product-price-row">
                        <strong>{price > 0 ? formatMoney(price) : 'Coming Soon'}</strong>
                        {compareAtPrice > price ? <span>{formatMoney(compareAtPrice)}</span> : null}
                      </div>

                      <Link className="landing-product-action" to={`/products/${product.slug}`} aria-label={`Open ${productName}`}>
                        +
                      </Link>
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="landing-empty">Products will appear here as soon as inventory is available.</p>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-tech" aria-labelledby="technology-title">
        <div className="landing-container landing-tech-layout">
          <div className="landing-tech-visual">
            {technicalSpotlightImage ? (
              <img
                src={technicalSpotlightImage}
                alt={normalizeDisplayText(topGears[1]?.name || topGears[0]?.name || 'XETA product close-up')}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="landing-image-fallback" aria-hidden="true" />
            )}

            <div className="landing-tech-stat">
              <strong>0.1ms</strong>
              <span>Industry-leading response target</span>
            </div>
          </div>

          <div className="landing-tech-copy">
            <p className="landing-overline">Engineered Performance</p>
            <h2 id="technology-title">Next-Gen Magnetic Switch Technology</h2>
            <p>
              A cleaner signal path, tighter tolerances, and better software tuning create consistency from the
              first click to the last round.
            </p>

            <div className="landing-tech-feature-list">
              {TECH_FEATURES.map((feature) => (
                <article key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="feedback-title">
        <div className="landing-container">
          <div className="landing-section-header landing-center-head">
            <div>
              <h2 id="feedback-title">Elite Player Feedback</h2>
              <p>Built from product review data with verified-buyer sentiment.</p>
            </div>
          </div>

          <div className="landing-review-grid">
            {reviewCards.length > 0 ? (
              reviewCards.map((review) => (
                <article key={review.id} className="landing-review-card">
                  <div className="landing-stars" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span key={`${review.id}-star-${index}`} className={index < review.rating ? 'filled' : ''}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p>{review.quote}</p>
                  <div>
                    <strong>{review.author}</strong>
                    <small>{review.role}</small>
                  </div>
                </article>
              ))
            ) : (
              <p className="landing-empty">No approved customer reviews with comments are available yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-surface" aria-labelledby="insight-title">
        <div className="landing-container">
          <div className="landing-insight-layout">
            <div className="landing-insight-list">
              {featureInsights.map((insight) => {
                const isOpen = insight.id === activeInsightId

                return (
                  <article key={insight.id} className={`landing-insight-item${isOpen ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="landing-insight-toggle"
                      onClick={() => {
                        setActiveInsightId((current) => (current === insight.id ? null : insight.id))
                      }}
                      aria-expanded={isOpen}
                    >
                      <span>{insight.title}</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {isOpen ? (
                      <div className="landing-insight-content">
                        <h3>{insight.lead}</h3>
                        <p>{insight.description}</p>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>

            <div className="landing-insight-media-card">
              {featureShowcaseImage ? (
                <img
                  src={featureShowcaseImage}
                  alt={featureShowcaseName || 'XETA featured hardware'}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="landing-image-fallback" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
      </section>

      {loadFailed ? (
        <section className="landing-inline-alert" role="status">
          Unable to sync live catalog data right now. The landing structure is active and will populate automatically on the next successful API call.
        </section>
      ) : null}
    </div>
  )
}

export default HomePage