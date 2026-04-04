import { useEffect, useMemo, useState, useRef } from 'react'
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

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'resolved', label: 'Resolved' },
]

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
]

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
  
  const replyImageRef = useRef(null)
  const [replyImage, setReplyImage] = useState(null)
  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedTicket) scrollToBottom()
  }, [selectedTicket])

  const filteredTickets = useMemo(() => {
    let results = [...tickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Tab filter
    if (activeTab === 'active') {
      results = results.filter(t => t.status !== 'resolved' && t.status !== 'closed')
    } else if (activeTab === 'waiting') {
      results = results.filter(t => t.status === 'waiting_customer')
    } else if (activeTab === 'resolved') {
      results = results.filter(t => t.status === 'resolved' || t.status === 'closed')
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(t => 
        t.subject?.toLowerCase().includes(q) || 
        t.ticket_number?.toLowerCase().includes(q) ||
        t.user?.email?.toLowerCase().includes(q)
      )
    }

    return results
  }, [tickets, activeTab, search])

  const tabCounts = useMemo(() => ({
    active: tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length,
    waiting: tickets.filter(t => t.status === 'waiting_customer').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  }), [tickets])

  async function loadTickets({ background = false } = {}) {
    if (!background) setLoadingList(true)
    try {
      const response = await getAdminSupportTickets({ per_page: 50 })
      const payload = readResource(response)
      // Laravel ResourceCollection wraps in { data: [...] }
      const records = payload?.data?.data ?? payload?.data ?? []
      setTickets(Array.isArray(records) ? records : [])
    } catch {
      if (!background) setError('Failed to load tickets.')
    } finally {
      if (!background) setLoadingList(false)
    }
  }

  useEffect(() => {
    loadTickets()
    const interval = setInterval(() => loadTickets({ background: true }), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

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
    try {
      const response = await updateAdminSupportTicket(selectedTicket.id, {
        status,
        resolution_summary: resolutionSummary.trim() || null,
      })
      const raw = readResource(response)
      const ticket = raw?.data ?? raw
      setSelectedTicket(ticket)
      setTickets(curr => curr.map(item => item.id === ticket.id ? ticket : item))
    } catch (err) {
      console.error('[handleUpdate]', err)
      alert('Update failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!reply.trim() && !replyImage) return
    setSaving(true)
    try {
      const formData = new FormData()
      if (reply.trim()) formData.append('message', reply.trim())
      if (replyImage) formData.append('image', replyImage)

      await createAdminSupportMessage(selectedTicket.id, formData)
      setReply('')
      setReplyImage(null)
      if (replyImageRef.current) replyImageRef.current.value = ''
      await loadTicket(selectedTicket.id)
    } catch {
      alert('Reply failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 0 }}>
      {/* Page Header */}
      <div style={{ padding: '24px 32px 16px', flexShrink: 0 }}>
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

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0, padding: '0 32px 24px' }}>
        
        {/* Inbox Sidebar */}
        <aside className="content-card" style={{ width: '380px', flexShrink: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            {filteredTickets.map(ticket => {
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
        <main className="content-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {!selectedTicket ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.4 }}>
              <MessageCircle size={48} />
              <p>Select a ticket to view conversation</p>
            </div>
          ) : (
            <>
              {/* Workspace Header */}
              <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', background: 'var(--color-surface-2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {selectedTicket.messages?.map((msg, idx) => {
                  const isStaff = msg.author_role === 'admin' || msg.author_role === 'staff'
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: isStaff ? 'flex-end' : 'flex-start' }}>
                      <div className={`message-bubble ${isStaff ? 'message-staff' : 'message-customer'}`} style={{ maxWidth: '75%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', opacity: 0.8 }}>
                          {isStaff ? <ShieldCheck size={12} /> : <User size={12} />}
                          <span style={{ fontSize: '11px', fontWeight: 700 }}>{msg.author_name || (isStaff ? 'Support Staff' : 'Customer')}</span>
                          <span style={{ fontSize: '10px', marginLeft: 'auto' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {msg.image_url && (
                          <img 
                            src={getAssetUrl(msg.image_url)} 
                            alt="Attachment" 
                            style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px', display: 'block' }} 
                            onClick={() => window.open(getAssetUrl(msg.image_url), '_blank')}
                          />
                        )}
                        <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.65' }}>{msg.message}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Triage & Reply Section */}
              <footer style={{ padding: '20px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-1)' }}>
                <form onSubmit={handleUpdate} style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                  <div style={{ flex: 1, maxWidth: '280px' }}>
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
                  <div className="textarea-container" style={{ position: 'relative', background: 'var(--color-surface-2)', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <textarea
                      className="textarea"
                      placeholder="Type your reply here..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      style={{ border: 'none', minHeight: '100px', background: 'transparent', resize: 'none', padding: '14px 16px', fontSize: '14px', lineHeight: '1.6' }}
                    />
                    <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-3)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="file" ref={replyImageRef} style={{ display: 'none' }} onChange={e => setReplyImage(e.target.files[0])} />
                        <button type="button" className="button-icon" onClick={() => replyImageRef.current?.click()}>
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
