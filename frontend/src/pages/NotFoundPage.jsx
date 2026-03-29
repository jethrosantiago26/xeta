import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="page-grid">
      <section className="content-card">
        <p className="eyebrow-inline">404</p>
        <h1>Page not found</h1>
        <p className="muted">The route you requested does not exist.</p>
        <Link className="button button-primary" to="/">
          Return home
        </Link>
      </section>
    </div>
  )
}

export default NotFoundPage