import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, User, MapPin, Calculator, Mail, Clock, ShoppingBag } from 'lucide-react'
import { formatMoney } from '../lib/format.js'

function CustomerDetailsPanel({ customer, isOpen, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState(null)

  useEffect(() => {
    if (customer) {
      setFormData({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        username: customer.username || '',
        phone: customer.phone || '',
        location_name: customer.location_name || '',
        address_line1: customer.address_line1 || '',
        address_line2: customer.address_line2 || '',
        city: customer.city || '',
        state: customer.state || '',
        postal_code: customer.postal_code || '',
        country: customer.country || '',
        timezone: customer.timezone || '',
      })
    }
  }, [customer])

  if (!isOpen || !customer || !formData) return null

  const name = customer.name || `${formData?.first_name || ''} ${formData?.last_name || ''}`.trim() || customer.username || 'Unnamed Customer'
  const joinedOn = customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'Unknown'
  const lastSeenOn = customer.updated_at ? new Date(customer.updated_at).toLocaleDateString() : 'Unknown'

  return createPortal(
    <>
      <div className="admin-side-panel-overlay customer-panel-overlay" onClick={onClose} />
      <aside className="admin-side-panel customer-panel" role="dialog" aria-modal="true" aria-label={`${name} customer details`}>
        <header className="customer-panel-header">
          <div className="customer-panel-identity">
            <div className="customer-panel-avatar">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="customer-panel-heading">
              <p className="customer-panel-kicker">Customer Profile</p>
              <h2 className="customer-panel-name">{name}</h2>
              <p className="customer-panel-meta">Customer ID #{customer.id}</p>
            </div>
          </div>
          <button type="button" className="admin-modal-close customer-panel-close" onClick={onClose} aria-label="Close customer panel">
            <X size={20} />
          </button>
        </header>

        <form id="customer-edit-form" className="customer-panel-body" onSubmit={(event) => { event.preventDefault(); onSave(formData); }}>
          <section className="customer-panel-stats" aria-label="Customer purchase summary">
            <article className="customer-stat-card">
              <div className="customer-stat-icon"><ShoppingBag size={14} /></div>
              <div className="customer-stat-body">
                <div className="customer-stat-value">{customer.orders_count || 0}</div>
                <div className="customer-stat-label">Orders</div>
              </div>
            </article>
            <article className="customer-stat-card customer-stat-card--value">
              <div className="customer-stat-icon"><Calculator size={14} /></div>
              <div className="customer-stat-body">
                <div className="customer-stat-value">{formatMoney(customer.orders_sum_total || 0)}</div>
                <div className="customer-stat-label">Total Value</div>
              </div>
            </article>
          </section>

          <section className="customer-panel-section">
            <div className="customer-panel-section-title">
              <User size={16} />
              <span>Basic Information</span>
            </div>

            <div className="customer-email-chip" title={customer.email || ''}>
              <Mail size={14} />
              <span>{customer.email || 'No email available'}</span>
            </div>

            <div className="customer-panel-grid customer-panel-grid--two">
              <label className="customer-field">
                <span className="customer-field-label">First Name</span>
                <input
                  type="text"
                  className="input"
                  value={formData.first_name}
                  onChange={(event) => setFormData({ ...formData, first_name: event.target.value })}
                />
              </label>

              <label className="customer-field">
                <span className="customer-field-label">Last Name</span>
                <input
                  type="text"
                  className="input"
                  value={formData.last_name}
                  onChange={(event) => setFormData({ ...formData, last_name: event.target.value })}
                />
              </label>

              <label className="customer-field">
                <span className="customer-field-label">Username</span>
                <input
                  type="text"
                  className="input"
                  value={formData.username}
                  onChange={(event) => setFormData({ ...formData, username: event.target.value })}
                />
              </label>

              <label className="customer-field">
                <span className="customer-field-label">Phone</span>
                <input
                  type="text"
                  className="input"
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  placeholder="09XXXXXXXXX"
                />
              </label>
            </div>
          </section>

          <section className="customer-panel-section">
            <div className="customer-panel-section-title">
              <MapPin size={16} />
              <span>Shipping Address</span>
            </div>

            <div className="customer-panel-grid">
              <label className="customer-field">
                <span className="customer-field-label">Location Name</span>
                <input
                  type="text"
                  className="input"
                  value={formData.location_name}
                  onChange={(event) => setFormData({ ...formData, location_name: event.target.value })}
                  placeholder="Home, Office, etc."
                />
              </label>

              <label className="customer-field">
                <span className="customer-field-label">Address Line 1</span>
                <input
                  type="text"
                  className="input"
                  value={formData.address_line1}
                  onChange={(event) => setFormData({ ...formData, address_line1: event.target.value })}
                />
              </label>

              <label className="customer-field">
                <span className="customer-field-label">Address Line 2</span>
                <input
                  type="text"
                  className="input"
                  value={formData.address_line2}
                  onChange={(event) => setFormData({ ...formData, address_line2: event.target.value })}
                />
              </label>

              <div className="customer-panel-grid customer-panel-grid--two">
                <label className="customer-field">
                  <span className="customer-field-label">City</span>
                  <input
                    type="text"
                    className="input"
                    value={formData.city}
                    onChange={(event) => setFormData({ ...formData, city: event.target.value })}
                  />
                </label>

                <label className="customer-field">
                  <span className="customer-field-label">State / Province</span>
                  <input
                    type="text"
                    className="input"
                    value={formData.state}
                    onChange={(event) => setFormData({ ...formData, state: event.target.value })}
                  />
                </label>
              </div>

              <div className="customer-panel-grid customer-panel-grid--two">
                <label className="customer-field">
                  <span className="customer-field-label">Postal Code</span>
                  <input
                    type="text"
                    className="input"
                    value={formData.postal_code}
                    onChange={(event) => setFormData({ ...formData, postal_code: event.target.value })}
                  />
                </label>

                <label className="customer-field">
                  <span className="customer-field-label">Country</span>
                  <input
                    type="text"
                    className="input"
                    value={formData.country}
                    onChange={(event) => setFormData({ ...formData, country: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="customer-panel-section">
            <div className="customer-panel-section-title">
              <Clock size={16} />
              <span>Preferences & History</span>
            </div>

            <div className="customer-panel-grid">
              <label className="customer-field">
                <span className="customer-field-label">Timezone</span>
                <input
                  type="text"
                  className="input"
                  value={formData.timezone}
                  onChange={(event) => setFormData({ ...formData, timezone: event.target.value })}
                  placeholder="Asia/Manila"
                />
              </label>

              <div className="customer-history-card">
                <div className="customer-history-row">
                  <span className="customer-history-label">Registered On</span>
                  <span>{joinedOn}</span>
                </div>
                <div className="customer-history-row">
                  <span className="customer-history-label">Last Active</span>
                  <span>{lastSeenOn}</span>
                </div>
              </div>
            </div>
          </section>
        </form>

        <footer className="customer-panel-footer">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" form="customer-edit-form" className="button button-primary" disabled={isSaving}>
            {isSaving ? 'Saving Changes...' : 'Save Customer'}
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  )
}

export default CustomerDetailsPanel
