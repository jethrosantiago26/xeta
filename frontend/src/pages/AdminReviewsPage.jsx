import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { 
  deleteAdminReview, 
  getAdminReviews, 
  readResource, 
  updateAdminReview, 
  restoreAdminReview, 
  forceDeleteAdminReview 
} from '../lib/api.js'
import { RotateCcw, AlertTriangle, Star, MessageSquare } from 'lucide-react'

const REVIEW_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
]

function StarRating({ rating }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          fill={star <= rating ? 'var(--color-notice-text)' : 'none'}
          color={star <= rating ? 'var(--color-notice-text)' : 'var(--color-text-muted)'}
        />
      ))}
    </div>
  )
}

function AdminReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [withArchived, setWithArchived] = useState(false)

  async function loadReviews() {
    setLoading(true)
    setError('')
    try {
      const response = await getAdminReviews({ per_page: 50, with_archived: withArchived ? 1 : 0 })
      const payload = readResource(response)
      setReviews(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setError('Failed to load reviews.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReviews() }, [withArchived])

  // Client-side tab filtering (no API refetch on tab switch)
  const filteredReviews = useMemo(() => {
    if (activeTab === 'all') return reviews
    if (activeTab === 'approved') return reviews.filter((r) => r.is_approved && !r.deleted_at)
    if (activeTab === 'pending') return reviews.filter((r) => !r.is_approved && !r.deleted_at)
    return reviews
  }, [reviews, activeTab])

  const tabCounts = useMemo(() => ({
    all: reviews.length,
    approved: reviews.filter((r) => r.is_approved && !r.deleted_at).length,
    pending: reviews.filter((r) => !r.is_approved && !r.deleted_at).length,
  }), [reviews])

  async function handleToggleApproval(review) {
    try {
      const response = await updateAdminReview(review.id, { is_approved: !review.is_approved })
      const payload = readResource(response)
      const updatedReview = payload.review ?? payload.data ?? payload
      setReviews((curr) => curr.map((r) => r.id === updatedReview.id ? updatedReview : r))
    } catch {
      alert('Failed to update review status.')
    }
  }

  async function handleArchive(review) {
    if (!window.confirm('Archive this review?')) return
    try {
      await deleteAdminReview(review.id)
      loadReviews()
    } catch {
      alert('Failed to archive review.')
    }
  }

  async function handleRestore(review) {
    try {
      await restoreAdminReview(review.id)
      loadReviews()
    } catch {
      alert('Failed to restore review.')
    }
  }

  async function handleForceDelete(review) {
    if (!window.confirm('WARNING: THIS IS PERMANENT. Delete this review forever?')) return
    try {
      await forceDeleteAdminReview(review.id)
      loadReviews()
    } catch {
      alert('Failed to permanently delete review.')
    }
  }

  return (
    <div className="page-grid">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader
          eyebrow="Content moderation"
          title="Reviews"
          description="Approve, hide, or remove customer product feedback."
        />
        <label className="admin-archive-toggle">
          <input
            type="checkbox"
            checked={withArchived}
            onChange={(e) => { setWithArchived(e.target.checked); setActiveTab('all') }}
          />
          Show Archived
        </label>
      </div>

      {/* Pipeline tabs */}
      {!withArchived && (
        <div className="pipeline-tabs">
          {REVIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`pipeline-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              {tabCounts[tab.key] > 0 && (
                <span className="pipeline-tab-count">{tabCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="notice">Loading reviews...</div>}
      {error && <div className="notice error">{error}</div>}

      {!loading && !error && (
        <>
          {filteredReviews.length === 0 ? (
            <div className="content-card" style={{ padding: '48px', textAlign: 'center' }}>
              <MessageSquare size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
              <p className="muted" style={{ margin: 0 }}>
                {activeTab === 'pending' ? 'No reviews awaiting moderation.' : 'No reviews found.'}
              </p>
            </div>
          ) : (
            <div className="review-card-grid">
              {filteredReviews.map((review) => {
                const isArchived = !!review.deleted_at
                const authorName = review.is_anonymous
                  ? 'Anonymous'
                  : (review.author_name || review.user?.name || review.user?.username || 'Unknown')

                return (
                  <div
                    key={review.id}
                    className={`review-card ${isArchived ? 'review-card--archived' : ''} ${!review.is_approved && !isArchived ? 'review-card--pending' : ''}`}
                  >
                    {/* Header */}
                    <div className="review-card-header">
                      <div className="review-card-author">
                        <div className="review-card-avatar">
                          {authorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="review-card-author-name">
                            {authorName}
                            {isArchived && <span className="status-pill status-archived" style={{ marginLeft: '8px', fontSize: '10px' }}>Archived</span>}
                          </div>
                          <div className="review-card-author-email">
                            {review.user?.email || review.user?.username || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="review-card-meta">
                        <StarRating rating={review.rating} />
                        <span
                          className={`status-pill ${
                            isArchived
                              ? 'status-archived'
                              : review.is_approved
                              ? 'success'
                              : 'warning'
                          }`}
                        >
                          {isArchived ? 'Archived' : review.is_approved ? 'Public' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    {/* Product */}
                    <div className="review-card-product">
                      <span className="chip">{review.product?.name ?? `Product #${review.product_id}`}</span>
                      <span className="review-card-date">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Comment */}
                    <div className="review-card-comment">
                      {review.comment
                        ? <p>{review.comment}</p>
                        : <p className="muted" style={{ fontStyle: 'italic' }}>No written review.</p>
                      }
                    </div>

                    {/* Actions */}
                    <div className="review-card-actions">
                      {!isArchived && (
                        <button
                          type="button"
                          className={`button ${review.is_approved ? 'button-secondary' : 'button-primary'}`}
                          style={{ flex: 1 }}
                          onClick={() => handleToggleApproval(review)}
                        >
                          {review.is_approved ? 'Hide from Public' : 'Approve & Publish'}
                        </button>
                      )}

                      {isArchived ? (
                        <>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleRestore(review)}
                            title="Restore review"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ color: 'var(--color-error)' }}
                            onClick={() => handleForceDelete(review)}
                            title="Delete permanently"
                          >
                            <AlertTriangle size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ color: 'var(--color-error)' }}
                          onClick={() => handleArchive(review)}
                          title="Archive review"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AdminReviewsPage
