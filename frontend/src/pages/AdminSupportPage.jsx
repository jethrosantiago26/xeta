import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import {
  createAdminSupportMessage,
  getAdminSupportTicket,
  getAdminSupportTickets,
  readResource,
  updateAdminSupportTicket,
  getAssetUrl,
} from '../lib/api.js'
import { 
  Send, 
  Search, 
  MessageCircle, 
  ShieldCheck, 
  User, 
  Clock, 
  Paperclip,
  ChevronRight
} from 'lucide-react'

const REFRESH_INTERVAL_MS = 10000
const SEARCH_DEBOUNCE_MS = 300

const TAB_STATUS_QUERY = {
  active: ['open', 'in_progress', 'waiting_customer'],
  waiting: ['waiting_customer'],
  resolved: ['resolved', 'closed'],
}

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'resolved', label: 'Resolved' },
]

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_customer', label: 'Waiting Customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const SUPPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024

function extractRequestErrorMessage(requestError, fallbackMessage) {
  const backendMessage = requestError?.response?.data?.message
  if (typeof backendMessage === 'string' && backendMessage.trim()) {
    return backendMessage
  }

  const validationErrors = requestError?.response?.data?.errors
  if (validationErrors && typeof validationErrors === 'object') {
    const firstErrorBucket = Object.values(validationErrors).find((value) => Array.isArray(value) && value.length > 0)
    if (Array.isArray(firstErrorBucket) && firstErrorBucket[0]) {
      return firstErrorBucket[0]
    }
  }

  return fallbackMessage
}

function validateImageAttachment(file) {
  if (!file) {
    return ''
  }

  if (!String(file.type || '').startsWith('image/')) {
    return 'Only image attachments are allowed.'
  }

  if (Number(file.size) > SUPPORT_IMAGE_MAX_BYTES) {
    return 'Image must be 5 MB or smaller.'
  }

  return ''
}

function AdminSupportPage() {
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [status, setStatus] = useState('open')
  const [resolutionSummary, setResolutionSummary] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('active')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tabCounts, setTabCounts] = useState({ active: 0, waiting: 0, resolved: 0 })
  
  const replyImageRef = useRef(null)
  const [replyImage, setReplyImage] = useState(null)
  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedTicket) scrollToBottom()
  }, [selectedTicket])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [search])

  const ticketQueryParams = useMemo(() => {
    const statuses = TAB_STATUS_QUERY[activeTab] ?? TAB_STATUS_QUERY.active
    const params = {
      per_page: 50,
      status: statuses.join(','),
    }

    if (debouncedSearch) {
      params.search = debouncedSearch
    }

    return params
  }, [activeTab, debouncedSearch])

  const displayTickets = useMemo(
    () => [...tickets].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)),
    [tickets],
  )

  const loadTickets = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoadingList(true)
    try {
      const response = await getAdminSupportTickets(ticketQueryParams)
      const payload = readResource(response)
      // Laravel ResourceCollection wraps in { data: [...] }
      const records = payload?.data?.data ?? payload?.data ?? []
      const parsedRecords = Array.isArray(records) ? records : []

      setTickets(parsedRecords)

      const serverCounts = payload?.status_counts
      if (serverCounts && typeof serverCounts === 'object') {
        setTabCounts({
          active: Number(serverCounts.active ?? 0),
          waiting: Number(serverCounts.waiting ?? 0),
          resolved: Number(serverCounts.resolved ?? 0),
        })
      } else {
        setTabCounts({
          active: parsedRecords.filter((ticket) => ticket.status !== 'resolved' && ticket.status !== 'closed').length,
          waiting: parsedRecords.filter((ticket) => ticket.status === 'waiting_customer').length,
          resolved: parsedRecords.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
        })
      }
    } catch {
      if (!background) setError('Failed to load tickets.')
    } finally {
      if (!background) setLoadingList(false)
    }
  }, [ticketQueryParams])

  useEffect(() => {
    loadTickets()
    const interval = setInterval(() => loadTickets({ background: true }), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [loadTickets])

  async function loadTicket(ticketId) {
    try {
      const response = await getAdminSupportTicket(ticketId)
      const raw = readResource(response)
      // Laravel JsonResource wraps single objects in { data: { ... } }
      const ticket = raw?.data ?? raw
      if (!ticket?.id) throw new Error('Empty ticket response')
      setSelectedTicket(ticket)
      setStatus(ticket.status)
      setResolutionSummary(ticket.resolution_summary || '')
    } catch (err) {
      setError('Failed to load ticket details.')
      console.error('[loadTicket]', err)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await updateAdminSupportTicket(selectedTicket.id, {
        status,
        resolution_summary: resolutionSummary.trim() || null,
      })
      const raw = readResource(response)
      const ticket = raw?.data ?? raw
      setSelectedTicket(ticket)
      setTickets(curr => curr.map(item => item.id === ticket.id ? ticket : item))
      await loadTickets({ background: true })
    } catch (err) {
      console.error('[handleUpdate]', err)
      setError(extractRequestErrorMessage(err, 'Update failed.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!reply.trim() && !replyImage) return
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      if (reply.trim()) formData.append('message', reply.trim())
      if (replyImage) formData.append('image', replyImage)

      await createAdminSupportMessage(selectedTicket.id, formData)
      setReply('')
      setReplyImage(null)
      if (replyImageRef.current) replyImageRef.current.value = ''
      await loadTicket(selectedTicket.id)
      await loadTickets({ background: true })
    } catch (err) {
      setError(extractRequestErrorMessage(err, 'Reply failed.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-support-page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 0 }}>
      {/* Page Header */}
      <div className="admin-support-header-wrap" style={{ padding: '24px 32px 16px', flexShrink: 0 }}>
        <PageHeader
          eyebrow="Operations"
          title="Support Inbox"
          description="Unified desk for customer inquiries and issue resolution."
        />
        {error ? (
          <div className="notice error" style={{ marginTop: '12px' }}>
            {error}
          </div>
        ) : null}
      </div>

      <div className="admin-support-layout" style={{ display: 'flex', gap: '22px', flex: 1, minHeight: 0, padding: '0 32px 24px' }}>
        
        {/* Inbox Sidebar */}
        <aside className="content-card admin-support-sidebar" style={{ width: 'min(420px, 36vw)', flexShrink: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                className="input"
                placeholder="Search inbox..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '13px', height: '36px' }}
              />
            </div>
            <div className="pipeline-tabs" style={{ background: 'var(--color-surface-3)', padding: '2px' }}>
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`pipeline-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {tab.label}
                  <span className="pipeline-tab-count" style={{ marginLeft: '4px' }}>{tabCounts[tab.key]}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingList ? <div className="notice">Loading...</div> : null}
            {!loadingList && displayTickets.length === 0 ? (
              <div className="notice">No tickets found for this filter.</div>
            ) : null}
            {displayTickets.map(ticket => {
              const isSelected = selectedTicket?.id === ticket.id
              return (
                <div
                  key={ticket.id}
                  onClick={() => loadTicket(ticket.id)}
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    background: isSelected ? 'var(--color-surface-3)' : 'transparent',
                    borderLeft: ticket.status === 'waiting_customer' ? '3px solid var(--color-notice-border)' : '3px solid transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>{ticket.ticket_number}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: '14px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ticket.subject}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`status-pill ${ticket.status === 'open' ? 'warning' : 'success'}`} style={{ fontSize: '10px', height: '18px' }}>
                      {ticket.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Workspace Area */}
        <main className="content-card admin-support-workspace" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {!selectedTicket ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.4 }}>
              <MessageCircle size={48} />
              <p>Select a ticket to view conversation</p>
            </div>
          ) : (
            <>
              {/* Workspace Header */}
              <header className="admin-support-workspace-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{selectedTicket.subject}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <User size={12} /> {selectedTicket.user?.name || 'Guest'} ({selectedTicket.user?.email || 'No email'})
                    <ChevronRight size={12} />
                    <Clock size={12} /> Created {new Date(selectedTicket.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className={`status-pill ${selectedTicket.status === 'open' ? 'warning' : selectedTicket.status === 'resolved' || selectedTicket.status === 'closed' ? 'success' : ''}`} style={{ textTransform: 'capitalize' }}>
                    {selectedTicket.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </header>

              {/* Chat View */}
              <div className="admin-support-chat" style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', background: 'var(--color-surface-2)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {selectedTicket.messages?.map((msg, idx) => {
                  const isStaff = msg.author_role === 'admin' || msg.author_role === 'staff'
                  const isAttachmentOnlyMessage = msg.message === 'Image attached' || msg.message === '📷 Image attached'
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: isStaff ? 'flex-end' : 'flex-start' }}>
                      <div className={`message-bubble admin-support-message-bubble ${isStaff ? 'message-staff' : 'message-customer'}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', opacity: 0.8 }}>
                          {isStaff ? <ShieldCheck size={12} /> : <User size={12} />}
                          <span style={{ fontSize: '11px', fontWeight: 700 }}>{msg.author_name || (isStaff ? 'Support Staff' : 'Customer')}</span>
                          <span style={{ fontSize: '10px', marginLeft: 'auto' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {msg.image_url && (
                          <img 
                            src={getAssetUrl(msg.image_url)} 
                            alt="Attachment" 
                            style={{
                              maxWidth: '100%',
                              borderRadius: '8px',
                              marginBottom: msg.message && !isAttachmentOnlyMessage ? '8px' : 0,
                              display: 'block',
                            }} 
                            onClick={() => window.open(getAssetUrl(msg.image_url), '_blank')}
                          />
                        )}
                        {msg.message && !isAttachmentOnlyMessage && (
                          <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.65' }}>{msg.message}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Triage & Reply Section */}
              <footer className="admin-support-footer" style={{ padding: '20px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-1)' }}>
                <form className="admin-support-triage-form" onSubmit={handleUpdate} style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                  <div className="admin-support-status-field" style={{ flex: 1, maxWidth: '280px' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Update Status</label>
                    <select className="select" style={{ height: '32px', fontSize: '12px' }} value={status} onChange={e => setStatus(e.target.value)}>
                      {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <button className="button button-secondary" type="submit" style={{ height: '32px', padding: '0 16px', fontSize: '12px' }} disabled={saving}>
                    Update Case
                  </button>
                </form>

                <form onSubmit={handleReply}>
                  <div className="textarea-container admin-support-composer-shell" style={{ position: 'relative', background: 'var(--color-surface-2)', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <textarea
                      className="textarea"
                      placeholder="Type your reply here..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      style={{ border: 'none', minHeight: '100px', background: 'transparent', resize: 'none', padding: '14px 16px', fontSize: '14px', lineHeight: '1.6' }}
                    />
                    <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-3)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="file"
                          ref={replyImageRef}
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            const validationError = validateImageAttachment(file)

                            if (validationError) {
                              setReplyImage(null)
                              setError(validationError)
                              if (replyImageRef.current) replyImageRef.current.value = ''
                              return
                            }

                            setError('')
                            setReplyImage(file)
                          }}
                        />
                        <button
                          type="button"
                          className={`admin-support-attach-button${replyImage ? ' active' : ''}`}
                          onClick={() => replyImageRef.current?.click()}
                          aria-label="Attach image"
                        >
                          <Paperclip size={16} />
                        </button>
                        {replyImage && <span style={{ fontSize: '11px', color: 'var(--color-accent)' }}>{replyImage.name}</span>}
                      </div>
                      <button className="button button-primary" type="submit" style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }} disabled={saving || (!reply.trim() && !replyImage)}>
                        <Send size={14} /> Send
                      </button>
                    </div>
                  </div>
                </form>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminSupportPage
