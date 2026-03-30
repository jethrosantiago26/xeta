import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import {
  createAdminSupportMessage,
  getAdminSupportTicket,
  getAdminSupportTickets,
  readResource,
  updateAdminSupportTicket,
} from '../lib/api.js'

const REFRESH_INTERVAL_MS = 8000

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_customer', label: 'Waiting customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function AdminSupportPage() {
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [status, setStatus] = useState('open')
  const [priority, setPriority] = useState('normal')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
  }, [tickets])

  async function loadTickets({ background = false } = {}) {
    if (!background) {
      setLoadingList(true)
      setError('')
    }

    try {
      const response = await getAdminSupportTickets({ per_page: 20 })
      const payload = readResource(response)
      const records = payload?.data?.data ?? payload?.data ?? []

      setTickets(Array.isArray(records) ? records : [])
    } catch (requestError) {
      if (!background) {
        setTickets([])
        setError(requestError?.response?.data?.message || 'Support tickets could not be loaded.')
      }
    } finally {
      if (!background) {
        setLoadingList(false)
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
        loadTicket(selectedTicket.id, { background: true })
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

  async function loadTicket(ticketId, { background = false } = {}) {
    if (!background) {
      setLoadingTicket(true)
      setError('')
      setSuccess('')
    }

    try {
      const response = await getAdminSupportTicket(ticketId)
      const payload = readResource(response)
      const ticket = payload?.data ?? payload
      setSelectedTicket(ticket)
      setStatus(ticket.status)
      setPriority(ticket.priority)
      setResolutionSummary(ticket.resolution_summary || '')
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

  async function handleUpdate(event) {
    event.preventDefault()

    if (!selectedTicket?.id) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await updateAdminSupportTicket(selectedTicket.id, {
        status,
        priority,
        resolution_summary: resolutionSummary.trim() || null,
      })
      const payload = readResource(response)
      const ticket = payload?.data ?? payload

      setSelectedTicket(ticket)
      setSuccess('Ticket updated.')
      setTickets((current) => current.map((item) => (item.id === ticket.id ? ticket : item)))
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReply(event) {
    event.preventDefault()

    if (!selectedTicket?.id || !reply.trim()) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await createAdminSupportMessage(selectedTicket.id, { message: reply.trim() })
      setReply('')
      await loadTicket(selectedTicket.id)
      setSuccess('Reply sent.')
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Reply could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Support"
        title="Support Inbox"
        description="Review customer tickets, reply, and resolve cases."
      />

      {loadingList ? <div className="notice">Loading support tickets...</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {success ? <div className="notice success">{success}</div> : null}

      <section className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)' }}>
        <div className="content-card">
          <h2>Ticket queue</h2>
          <p className="muted">Select a ticket to triage.</p>
          <div className="stack">
            {sortedTickets.length === 0 ? (
              <p className="muted">No tickets in queue.</p>
            ) : (
              sortedTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="content-card"
                  style={{ textAlign: 'left' }}
                  onClick={() => loadTicket(ticket.id)}
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

        <div className="content-card">
          <h2>Ticket workspace</h2>
          {loadingTicket ? <p className="muted">Loading ticket...</p> : null}
          {!selectedTicket ? (
            <p className="muted">Select a ticket to start working.</p>
          ) : (
            <div className="stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3>{selectedTicket.subject}</h3>
                  <p className="muted">{selectedTicket.ticket_number} · {selectedTicket.type}</p>
                </div>
                <span className="status-pill">{selectedTicket.status}</span>
              </div>
              <div className="divider" />
              <form className="stack" onSubmit={handleUpdate}>
                <div className="field-grid">
                  <label className="stack" style={{ gap: '6px' }}>
                    <span className="muted">Status</span>
                    <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="stack" style={{ gap: '6px' }}>
                    <span className="muted">Priority</span>
                    <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)}>
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  className="textarea"
                  placeholder="Resolution summary (optional)"
                  value={resolutionSummary}
                  onChange={(event) => setResolutionSummary(event.target.value)}
                />
                <div className="actions">
                  <button className="button button-secondary" type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Update ticket'}
                  </button>
                </div>
              </form>

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
                  placeholder="Reply to the customer..."
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                />
                <div className="actions">
                  <button className="button button-primary" type="submit" disabled={saving}>
                    {saving ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default AdminSupportPage
