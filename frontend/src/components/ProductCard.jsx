import { Link } from 'react-router-dom'
import { formatMoney } from '../lib/format.js'

function ProductCard({ product }) {
  const image = product.primary_image || product.images?.[0]?.url || '/vite.svg'
  const price = product.lowest_price ?? product.variants?.[0]?.price ?? 0

  return (
    <article className="product-card">
      <Link to={`/products/${product.slug}`} style={{ display: 'block', overflow: 'hidden', borderRadius: '10px' }}>
        <img src={image} alt={product.name} />
      </Link>
      <div className="stack" style={{ marginTop: '14px', gap: '8px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="meta" style={{ margin: 0 }}>{product.category?.name ?? 'Peripherals'}</p>
          {product.average_rating ? (
            <span className="status-pill" style={{ fontSize: '10px' }}>
              ★ {Number(product.average_rating).toFixed(1)}
            </span>
          ) : null}
        </div>
        <h3 style={{ fontSize: '13px', lineHeight: 1.35 }}>{product.name}</h3>
        <p className="muted" style={{ fontSize: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.description?.slice(0, 100) || 'High quality peripherals for work and play.'}
        </p>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: '4px' }}>
          <strong className="price">
            {price > 0 ? `from ${formatMoney(price)}` : 'See options'}
          </strong>
          <Link
            className="button button-secondary"
            to={`/products/${product.slug}`}
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            View
          </Link>
        </div>
      </div>
    </article>
  )
}

export default ProductCard