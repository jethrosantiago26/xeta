import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import {
  createSupportMessage,
  createSupportTicket,
  getOrders,
  getSupportTicket,
  getSupportTickets,
  readResource,
} from '../lib/api.js'

const REFRESH_INTERVAL_MS = 8000

const emptyTicketForm = {
  subject: '',
  type: 'order',
  order_id: null,
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

function formatMessageTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isCustomerMessage(message) {
  return message.author_role === 'customer' || message.author_role === 'user'
}

function getStatusColor(status) {
  switch (status) {
    case 'open': return 'var(--color-accent)'
    case 'in_progress': return 'var(--color-notice-text)'
    case 'resolved': case 'closed': return 'var(--color-success-text)'
    case 'waiting_customer': return '#f97316'
    default: return 'var(--color-text-muted)'
  }
}

function SupportPage() {
  const [tickets, setTickets] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [form, setForm] = useState(emptyTicketForm)
  const [reply, setReply] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const messagesEndRef = useRef(null)
  const composerRef = useRef(null)

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
  }, [tickets])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedTicket?.messages?.length) {
      scrollToBottom()
    }
  }, [selectedTicket?.messages?.length])

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

  async function loadOrders() {
    try {
      const response = await getOrders({ per_page: 20 })
      const payload = readResource(response)
      const records = Array.isArray(payload?.data) ? payload.data : (payload?.data?.data ?? [])
      setOrders(records)
    } catch {
      // ignore silently for background tasks
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
      await loadOrders()
    }

    function refreshVisibleData() {
      if (document.hidden || !active) {
        return
      }

      loadTickets({ background: true })
      loadOrders()

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

    let finalMessage = form.message.trim()
    if (form.type === 'order' && form.order_id) {
      const relatedOrder = orders.find(o => o.id === form.order_id)
      if (relatedOrder) {
        finalMessage = `Order Reference: ${relatedOrder.order_number}\n\n${finalMessage}`
      }
    }

    try {
      const response = await createSupportTicket({
        subject: form.subject.trim(),
        type: form.type,
        priority: form.priority,
        message: finalMessage,
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

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleReply(event)
    }
  }

  const messages = selectedTicket?.messages || []

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Help center"
        title="Support"
        description="Submit a ticket and we will follow up by email and in this dashboard."
        action={
          <Link className="button button-secondary" to="/faq">
            Browse FAQ
          </Link>
        }
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

            {form.type === 'order' && orders.length > 0 && (
              <div className="support-order-selector">
                <span className="muted">Which order is this about?</span>
                <div className="support-order-list">
                  {orders.map((order) => {
                    const isSelected = form.order_id === order.id
                    return (
                      <button
                        key={order.id}
                        type="button"
                        className={`support-order-item${isSelected ? ' selected' : ''}`}
                        onClick={() => setForm((current) => ({ ...current, order_id: order.id }))}
                      >
                        <div className="support-order-item-thumbs">
                          {(order.items ?? []).slice(0, 3).map((item, idx) => (
                            <img
                              key={item.id || idx}
                              src={item?.variant?.image_url || item?.product?.image_url || '/vite.svg'}
                              alt={item.product_name}
                              className="support-order-item-thumb"
                              loading="lazy"
                            />
                          ))}
                        </div>
                        <div className="support-order-item-info">
                          <div className="support-order-item-number">{order.order_number}</div>
                          <div className="support-order-item-meta">
                            {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {(order.items ?? []).length} item{(order.items ?? []).length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div className="support-order-check">
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

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

        {/* ── Ticket List (Apple-style sidebar) ── */}
        <div className="content-card chat-ticket-list-card">
          <h2>Your tickets</h2>
          <div className="chat-ticket-list">
            {sortedTickets.length === 0 ? (
              <p className="muted" style={{ padding: '16px 0' }}>No tickets yet.</p>
            ) : (
              sortedTickets.map((ticket) => {
                const isActive = selectedTicket?.id === ticket.id
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`chat-ticket-item${isActive ? ' active' : ''}`}
                    onClick={() => refreshTicket(ticket.id)}
                  >
                    <div className="chat-ticket-item-dot" style={{ background: getStatusColor(ticket.status) }} />
                    <div className="chat-ticket-item-body">
                      <div className="chat-ticket-item-top">
                        <span className="chat-ticket-item-subject">{ticket.subject}</span>
                        <span className="chat-ticket-item-time">
                          {formatMessageTime(ticket.updated_at || ticket.created_at)}
                        </span>
                      </div>
                      <div className="chat-ticket-item-meta">
                        {ticket.ticket_number} · {ticket.type}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* ── Messenger Conversation ── */}
      <section className="chat-messenger-card">
        {!selectedTicket ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">💬</div>
            <h3>No conversation selected</h3>
            <p className="muted">Select a ticket above to view the conversation.</p>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="chat-header">
              <div className="chat-header-info">
                <div className="chat-header-avatar chat-avatar-support">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="chat-header-title">{selectedTicket.subject}</h3>
                  <span className="chat-header-meta">
                    {selectedTicket.ticket_number} · {selectedTicket.type} · {selectedTicket.priority}
                  </span>
                </div>
              </div>
              <span
                className="chat-status-badge"
                style={{
                  '--badge-color': getStatusColor(selectedTicket.status),
                }}
              >
                {selectedTicket.status?.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Messages Area */}
            <div className="chat-messages-scroll">
              {loadingTicket && messages.length === 0 ? (
                <div className="chat-empty-state">
                  <p className="muted">Loading conversation…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-empty-state">
                  <p className="muted">No messages yet. Start the conversation below.</p>
                </div>
              ) : (
                <div className="chat-messages">
                  {messages.map((message, index) => {
                    const isMine = isCustomerMessage(message)
                    const isSystem = message.author_role === 'system'
                    const prevMsg = messages[index - 1]
                    const showDateSep = !prevMsg ||
                      new Date(message.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString()
                    const sameAuthorAsPrev = prevMsg && prevMsg.author_role === message.author_role
                    const authorInitial = (message.author_name || message.author_role || '?')[0].toUpperCase()

                    return (
                      <div key={message.id}>
                        {showDateSep && (
                          <div className="chat-date-separator">
                            <span>{new Date(message.created_at).toLocaleDateString(undefined, {
                              weekday: 'long', month: 'long', day: 'numeric',
                            })}</span>
                          </div>
                        )}
                        {isSystem ? (
                          <div className="chat-system-message">
                            <span>{message.message}</span>
                          </div>
                        ) : (
                          <div className={`chat-bubble-row${isMine ? ' mine' : ' theirs'}${sameAuthorAsPrev ? ' consecutive' : ''}`}>
                            {!isMine && (
                              <div className={`chat-avatar chat-avatar-support${sameAuthorAsPrev ? ' invisible' : ''}`}>
                                {authorInitial}
                              </div>
                            )}
                            <div className="chat-bubble-group">
                              {!sameAuthorAsPrev && !isMine && (
                                <span className="chat-bubble-author">
                                  {message.author_name || 'Support'}
                                </span>
                              )}
                              <div className={`chat-bubble${isMine ? ' chat-bubble-mine' : ' chat-bubble-theirs'}`}>
                                <p className="chat-bubble-text">{message.message}</p>
                              </div>
                              <span className="chat-bubble-time">
                                {formatMessageTime(message.created_at)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Composer Bar */}
            <form className="chat-composer" onSubmit={handleReply}>
              <textarea
                ref={composerRef}
                className="chat-composer-input"
                placeholder="Type a message…"
                value={reply}
                rows={1}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={handleComposerKeyDown}
              />
              <button
                className="chat-composer-send"
                type="submit"
                disabled={submitting || !reply.trim()}
                aria-label="Send message"
              >
                {submitting ? (
                  <span className="chat-send-spinner" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </form>
          </>
        )}
      </section>

      <section className="content-card faq-handoff-card">
        <div>
          <p className="eyebrow-inline">Need a quick answer?</p>
          <h2>Visit the dedicated FAQ page.</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            It covers shipping, returns, account support, and order updates in one streamlined flow.
          </p>
        </div>
        <Link className="button button-primary" to="/faq">
          Open FAQ
        </Link>
      </section>
    </div>
  )
}

export default SupportPage
