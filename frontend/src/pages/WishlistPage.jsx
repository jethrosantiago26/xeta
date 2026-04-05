import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'

function WishlistPage() {
  const { items, clearWishlist } = useWishlist()
  const itemLabel = items.length === 1 ? 'product' : 'products'

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
            onClick={clearWishlist}
          >
            Clear wishlist
          </button>
        ) : null}
      />

      <section className="toolbar">
        <p className="muted">
          {items.length} saved {itemLabel}
        </p>
      </section>

      {items.length === 0 ? (
        <section className="notice">
          Your wishlist is empty. Browse the{' '}
          <Link to="/products">catalog</Link>{' '}
          and tap the heart icon to save products.
        </section>
      ) : (
        <section className="catalog-product-grid catalog-product-grid--3">
          {items.map((product, index) => (
            <ProductCard
              key={product.slug}
              product={product}
              prioritizeImage={index < 2}
              imageFetchPriority={index === 0 ? 'high' : 'auto'}
              layout="card"
              showDescription
            />
          ))}
        </section>
      )}
    </div>
  )
}

export default WishlistPage
