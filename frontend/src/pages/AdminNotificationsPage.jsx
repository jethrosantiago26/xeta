import { createElement, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, Mail, Send, ShieldCheck, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { readResource, sendAdminMarketingNotification } from '../lib/api.js'

const MODE_OPTIONS = [
  {
    key: 'preview',
    label: 'Preview',
    hint: 'No emails are sent',
  },
  {
    key: 'send',
    label: 'Send',
    hint: 'Deliver to opted-in users',
  },
]

function getSummaryMetricPresentation(label) {
  const normalizedLabel = String(label || '').toLowerCase()

  if (normalizedLabel.includes('failed')) {
    return { icon: AlertTriangle, accent: 'var(--color-error-text)' }
  }

  if (normalizedLabel.includes('sent')) {
    return { icon: CheckCircle2, accent: 'var(--color-success-text)' }
  }

  if (normalizedLabel.includes('deliverable')) {
    return { icon: Mail, accent: '#2f9b8f' }
  }

  if (normalizedLabel.includes('opted')) {
    return { icon: Users, accent: '#4f7cff' }
  }

  return { icon: Users, accent: '#7b9eff' }
}

function SummaryMetric({ icon, label, value, accent = undefined }) {
  return (
    <div className="dashboard-kpi-card">
      <div className="dashboard-kpi-icon" style={accent ? { background: `${accent}20`, color: accent, borderColor: `${accent}40` } : {}}>
        {createElement(icon, { size: 18 })}
      </div>
      <div className="dashboard-kpi-body">
        <div className="dashboard-kpi-value">{value}</div>
        <div className="dashboard-kpi-label">{label}</div>
      </div>
    </div>
  )
}

function AdminNotificationsPage() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [limit, setLimit] = useState(1000)
  const [previewOnly, setPreviewOnly] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const normalizedLimit = useMemo(() => {
    const parsed = Number(limit)

    if (!Number.isFinite(parsed)) {
      return 1000
    }

    return Math.max(1, Math.min(1000, Math.round(parsed)))
  }, [limit])

  const recipientCount = Number(result?.recipient_count ?? 0)
  const sentCount = Number(result?.sent_count ?? 0)
  const failedCount = Number(result?.failed_count ?? 0)

  const summaryMetrics = useMemo(() => {
    if (Array.isArray(result?.run_summary) && result.run_summary.length > 0) {
      return result.run_summary
        .filter((entry) => entry && typeof entry.label === 'string')
        .map((entry) => {
          const value = Number(entry.value)

          return {
            label: entry.label,
            value: Number.isFinite(value) ? value : entry.value,
            ...getSummaryMetricPresentation(entry.label),
          }
        })
    }

    return [
      { label: 'Recipients', value: recipientCount, icon: Users, accent: '#7b9eff' },
      { label: 'Sent', value: sentCount, icon: CheckCircle2, accent: 'var(--color-success-text)' },
      { label: 'Failed', value: failedCount, icon: AlertTriangle, accent: 'var(--color-error-text)' },
    ]
  }, [result, recipientCount, sentCount, failedCount])

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedSubject = subject.trim()
    const trimmedMessage = message.trim()

    if (!trimmedSubject || !trimmedMessage) {
      setError('Subject and message are required.')
      setResult(null)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await sendAdminMarketingNotification({
        subject: trimmedSubject,
        message: trimmedMessage,
        preview_only: previewOnly,
        limit: normalizedLimit,
      })

      setResult(readResource(response))
    } catch (requestError) {
      const backendMessage = requestError?.response?.data?.message
      setError(backendMessage || 'Failed to process marketing notification request.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-grid admin-page-grid">
      <PageHeader
        eyebrow="Communication"
        title="Notifications"
        description="Prepare and send marketing campaigns to users who opted in for marketing emails."
      />

      <div className="notifications-layout">
        <section className="content-card notifications-composer-card">
          <div className="section-label notifications-heading">
            <div className="notifications-heading-main">
              <Mail size={16} />
              <h2>Campaign Composer</h2>
            </div>
            <div className="section-rule" aria-hidden="true" />
          </div>

          <div className="pipeline-tabs notifications-mode-tabs" role="tablist" aria-label="Campaign mode">
            {MODE_OPTIONS.map((mode) => {
              const isActive = (mode.key === 'preview') === previewOnly

              return (
                <button
                  key={mode.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`pipeline-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setPreviewOnly(mode.key === 'preview')}
                >
                  <span>{mode.label}</span>
                  <span className="pipeline-tab-count">{mode.hint}</span>
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="notifications-form">
            <div className="stack" style={{ gap: '8px' }}>
              <label className="caption" htmlFor="marketing-subject">Subject</label>
              <input
                id="marketing-subject"
                className="input"
                placeholder="Example: New arrivals this week"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={200}
              />
            </div>

            <div className="stack" style={{ gap: '8px' }}>
              <label className="caption" htmlFor="marketing-message">Message</label>
              <textarea
                id="marketing-message"
                className="textarea"
                placeholder="Write the body of your campaign email..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={10000}
                rows={10}
              />
            </div>

            <div className="notifications-grid">
              <div className="stack" style={{ gap: '8px' }}>
                <label className="caption" htmlFor="marketing-limit">Recipient limit</label>
                <input
                  id="marketing-limit"
                  className="input"
                  type="number"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                />
              </div>

              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={previewOnly}
                  onChange={(event) => setPreviewOnly(event.target.checked)}
                />
                <span>Preview only (do not send emails)</span>
              </label>
            </div>

            <div className="notifications-footer">
              <button type="submit" className="button button-primary" disabled={loading}>
                {loading
                  ? 'Processing...'
                  : previewOnly
                    ? 'Run recipient preview'
                    : 'Send campaign'}
              </button>

              <span className={`notifications-mode-badge ${previewOnly ? 'preview' : 'live'}`}>
                {previewOnly ? <Eye size={14} /> : <Send size={14} />}
                {previewOnly ? 'Safe mode enabled' : 'Delivery mode enabled'}
              </span>
            </div>
          </form>

          {error ? <div className="notice error">{error}</div> : null}
        </section>

        <aside className="content-card notifications-guide-card">
          <div className="section-label notifications-heading">
            <div className="notifications-heading-main">
              <ShieldCheck size={16} />
              <h2>Delivery Checklist</h2>
            </div>
            <div className="section-rule" aria-hidden="true" />
          </div>

          <ul className="notifications-checklist">
            <li>Keep subject short and clear so open rates stay high.</li>
            <li>Use preview mode first to confirm recipient selection.</li>
            <li>Set a sensible recipient limit before switching to send mode.</li>
            <li>Ensure your Resend sending domain is verified for live delivery.</li>
          </ul>

          <div className="notice">
            Start with preview mode, review recipients, then run delivery mode once content is finalized.
          </div>
        </aside>
      </div>

      {result ? (
        <section className="content-card notifications-summary-card">
          <div className="section-label">
            <div className="notifications-heading-main">
              <Users size={16} />
              <h2>Run Summary</h2>
            </div>
            <div className="section-rule" aria-hidden="true" />
          </div>

          <div className="dashboard-kpi-grid notifications-summary-grid">
            {summaryMetrics.map((metric) => (
              <SummaryMetric
                key={metric.label}
                icon={metric.icon}
                label={metric.label}
                value={metric.value}
                accent={metric.accent}
              />
            ))}
          </div>

          {Array.isArray(result.sample_recipients) && result.sample_recipients.length > 0 ? (
            <div>
              <p className="caption" style={{ marginBottom: '8px' }}>Preview recipients</p>
              <div className="notifications-recipient-list">
                {result.sample_recipients.map((email) => (
                  <div key={email} className="pill notifications-recipient-pill">
                    {email}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`notice ${failedCount > 0 ? 'error' : 'success'}`}>
            {result.message || 'Campaign action completed.'}
          </div>

          {Array.isArray(result.failure_reasons) && result.failure_reasons.length > 0 ? (
            <ul className="notifications-checklist" style={{ marginTop: '4px' }}>
              {result.failure_reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default AdminNotificationsPage
