import { useEffect, useState } from 'react'
import { deleteAdminReview, getAdminReviews, readResource, updateAdminReview } from '../lib/api.js'

function AdminReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, approved, pending

  async function loadReviews() {
    setLoading(true)
    setError('')
    try {
      const params = { per_page: 50 }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      const response = await getAdminReviews(params)
      const payload = readResource(response)
      const data = payload.data ?? []
      setReviews(data)
    } catch (err) {
      setError('Failed to load reviews.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function handleToggleApproval(review) {
    try {
      const response = await updateAdminReview(review.id, {
        is_approved: !review.is_approved
      })
      const payload = readResource(response)
      const updatedReview = payload.review ?? payload.data ?? payload
      setReviews((curr) => curr.map((r) => r.id === updatedReview.id ? updatedReview : r))
    } catch (err) {
      alert('Failed to update review status.')
    }
  }

  async function handleDelete(review) {
    if (!window.confirm('Are you sure you want to delete this review entirely?')) {
      return
    }

    try {
      await deleteAdminReview(review.id)
      setReviews((curr) => curr.filter((r) => r.id !== review.id))
    } catch (err) {
      alert('Failed to delete review.')
    }
  }

  return (
    <div className="admin-page-content">
      <header className="admin-page-header">
        <div>
          <h1>Reviews Moderation</h1>
          <p className="muted">Manage and approve customer product feedback.</p>
        </div>
      </header>

      {error ? (
        <div className="notice error" style={{ marginBottom: '24px' }}>
          {error}
        </div>
      ) : null}

      <div className="admin-card">
        <div className="admin-card-header" style={{ display: 'flex', gap: '8px', padding: '16px' }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="all">All Reviews</option>
            <option value="approved">Approved (Public)</option>
            <option value="pending">Hidden (Flagged)</option>
          </select>
        </div>

        {loading ? (
          <div className="admin-card-body" style={{ padding: '32px', textAlign: 'center' }}>
            <p className="muted">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="admin-card-body" style={{ padding: '32px', textAlign: 'center' }}>
            <p className="muted">No reviews found.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{review.author_name || review.user?.first_name || 'Anonymous'}</span>
                        <small className="muted" style={{ fontSize: '12px' }}>
                          {review.is_anonymous ? 'Posted as anonymous' : review.user?.email}
                        </small>
                      </div>
                    </td>
                    <td>
                      <span className="pill">{review.product?.name ?? `Product #${review.product_id}`}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-500)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{review.rating}</span>
                      </div>
                    </td>
                    <td>
                      <p style={{ margin: 0, maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }} title={review.comment}>
                        {review.comment || <em className="muted">No text</em>}
                      </p>
                    </td>
                    <td>
                      {review.is_approved ? (
                        <span className="status-pill success" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}>Public</span>
                      ) : (
                        <span className="status-pill warning" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}>Hidden</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                          onClick={() => handleToggleApproval(review)}
                        >
                          {review.is_approved ? 'Hide' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="button button-danger"
                          style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                          onClick={() => handleDelete(review)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminReviewsPage
