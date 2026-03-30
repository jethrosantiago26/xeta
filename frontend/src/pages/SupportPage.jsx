import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import {
  createSupportMessage,
  createSupportTicket,
  getSupportTicket,
  getSupportTickets,
  readResource,
} from '../lib/api.js'

const REFRESH_INTERVAL_MS = 8000

const emptyTicketForm = {
  subject: '',
  type: 'order',
  priority: 'normal',
  message: '',
}

const ticketTypes = [
  { value: 'order', label: 'Order' },
  { value: 'payment', label: 'Payment' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'product', label: 'Product' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const faqItems = [
  {
    question: 'Where can I see my order updates?',
    answer: 'Visit Orders to track status, tracking numbers, and delivery updates.',
  },
  {
    question: 'Can I change my delivery address after checkout?',
    answer: 'If the order has not shipped, send a ticket immediately with your order number and new address.',
  },
  {
    question: 'How long does support reply take?',
    answer: 'Most tickets receive a reply within 1 business day. Urgent tickets are prioritized.',
  },
  {
    question: 'How do I request a return or exchange?',
    answer: 'Open a ticket, choose Product or Order, and include photos plus your order number.',
  },
]

function SupportPage() {
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [form, setForm] = useState(emptyTicketForm)
  const [reply, setReply] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
  }, [tickets])

  async function loadTickets({ background = false } = {}) {
    if (!background) {
      setLoadingList(true)
      setError('')
    }

    try {
      const response = await getSupportTickets({ per_page: 10 })
      const payload = readResource(response)
      const records = payload?.data?.data ?? payload?.data ?? []

      setTickets(Array.isArray(records) ? records : [])
    } catch (requestError) {
      if (!background) {
        setTickets([])
        setError(requestError?.response?.data?.message || 'Support tickets could not be loaded right now.')
      }
    } finally {
      if (!background) {
        setLoadingList(false)
      }
    }
  }

  async function refreshTicket(ticketId, { background = false } = {}) {
    if (!ticketId) {
      return
    }

    if (!background) {
      setLoadingTicket(true)
      setError('')
    }

    try {
      const response = await getSupportTicket(ticketId)
      const payload = readResource(response)

      setSelectedTicket(payload?.data ?? payload)
    } catch (requestError) {
      if (!background) {
        setError(requestError?.response?.data?.message || 'Ticket details could not be loaded.')
      }
    } finally {
      if (!background) {
        setLoadingTicket(false)
      }
    }
  }

  useEffect(() => {
    let active = true

    async function boot() {
      if (!active) {
        return
      }

      await loadTickets()
    }

    function refreshVisibleData() {
      if (document.hidden || !active) {
        return
      }

      loadTickets({ background: true })

      if (selectedTicket?.id) {
        refreshTicket(selectedTicket.id, { background: true })
      }
    }

    boot()

    const intervalId = window.setInterval(refreshVisibleData, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshVisibleData)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshVisibleData)
    }
  }, [selectedTicket?.id])

  async function handleCreateTicket(event) {
    event.preventDefault()

    if (!form.subject.trim() || !form.message.trim()) {
      setError('Subject and message are required.')
      setSuccess('')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await createSupportTicket({
        subject: form.subject.trim(),
        type: form.type,
        priority: form.priority,
        message: form.message.trim(),
      })

      const payload = readResource(response)
      const ticket = payload?.data ?? payload

      setForm(emptyTicketForm)
      setSuccess('Support ticket submitted. We will reply soon.')
      setTickets((current) => [ticket, ...current])
      setSelectedTicket(ticket)
      await refreshTicket(ticket.id)
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Ticket submission failed. Please try again.')
      setSuccess('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReply(event) {
    event.preventDefault()

    if (!selectedTicket?.id || !reply.trim()) {
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await createSupportMessage(selectedTicket.id, { message: reply.trim() })
      setReply('')
      await refreshTicket(selectedTicket.id)
      setSuccess('Reply sent.')
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Reply could not be sent.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Help center"
        title="Support"
        description="Submit a ticket and we will follow up by email and in this dashboard."
      />

      {loadingList ? <div className="notice">Loading support tickets...</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {success ? <div className="notice success">{success}</div> : null}

      <section className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' }}>
        <div className="content-card">
          <h2>Open a ticket</h2>
          <p className="muted">Share order numbers, photos, and details to speed up a resolution.</p>
          <form className="stack" onSubmit={handleCreateTicket}>
            <input
              className="input"
              placeholder="Subject"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            />
            <div className="field-grid">
              <label className="stack" style={{ gap: '6px' }}>
                <span className="muted">Type</span>
                <select
                  className="select"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                >
                  {ticketTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="stack" style={{ gap: '6px' }}>
                <span className="muted">Priority</span>
                <select
                  className="select"
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              className="textarea"
              placeholder="Describe the issue, include order numbers or photo links."
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            />
            <div className="actions">
              <button className="button button-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Submit ticket'}
              </button>
            </div>
          </form>
        </div>

        <div className="content-card">
          <h2>Your recent tickets</h2>
          <p className="muted">Select a ticket to read and reply.</p>
          <div className="stack">
            {sortedTickets.length === 0 ? (
              <p className="muted">No tickets yet.</p>
            ) : (
              sortedTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="content-card"
                  style={{ textAlign: 'left' }}
                  onClick={() => refreshTicket(ticket.id)}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <h3>{ticket.subject}</h3>
                      <p className="muted">{ticket.ticket_number} · {ticket.type}</p>
                    </div>
                    <span className="status-pill">{ticket.status}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="content-card">
        <h2>Ticket conversation</h2>
        {loadingTicket ? <p className="muted">Loading ticket conversation...</p> : null}
        {!selectedTicket ? (
          <p className="muted">Select a ticket to see the conversation.</p>
        ) : (
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{selectedTicket.subject}</h3>
                <p className="muted">{selectedTicket.ticket_number} · {selectedTicket.type} · {selectedTicket.priority}</p>
              </div>
              <span className="status-pill">{selectedTicket.status}</span>
            </div>
            <div className="divider" />
            <div className="stack">
              {(selectedTicket.messages || []).map((message) => (
                <div key={message.id} className="content-card">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{message.author_name || message.author_role}</strong>
                    <span className="muted">{new Date(message.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ marginBottom: 0 }}>{message.message}</p>
                </div>
              ))}
            </div>
            <form className="stack" onSubmit={handleReply}>
              <textarea
                className="textarea"
                placeholder="Reply to support..."
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
              <div className="actions">
                <button className="button button-secondary" type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send reply'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      <section className="content-card">
        <h2>FAQ</h2>
        <p className="muted">Quick answers before you open a ticket.</p>
        <div className="stack">
          {faqItems.map((item) => (
            <details key={item.question} className="content-card">
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{item.question}</summary>
              <p className="muted" style={{ marginTop: '10px' }}>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

export default SupportPage
