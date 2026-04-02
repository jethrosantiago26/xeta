import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, User, MapPin, Calculator, Phone, Mail, Clock, ShoppingBag } from 'lucide-react'
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
        preferred_contact_method: customer.preferred_contact_method || 'email',
      })
    }
  }, [customer])

  if (!isOpen || !customer) return null

  const name = customer.name || `${formData?.first_name || ''} ${formData?.last_name || ''}`.trim() || customer.username || 'Unnamed Customer'

  return createPortal(
    <div className="product-editor-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="product-editor-panel customer-panel">
        <header className="product-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="review-card-avatar" style={{ width: '40px', height: '40px' }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>{name}</h2>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Customer ID: #{customer.id}</div>
            </div>
          </div>
          <button type="button" className="product-editor-close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="product-editor-content">
          {/* Stats Bar */}
          <div className="dashboard-kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '24px' }}>
            <div className="dashboard-kpi-card" style={{ padding: '12px 16px' }}>
              <div className="dashboard-kpi-icon" style={{ width: '32px', height: '32px', background: 'var(--color-accent-bg)' }}>
                <ShoppingBag size={14} color="var(--color-accent)" />
              </div>
              <div className="dashboard-kpi-body">
                <div className="dashboard-kpi-value" style={{ fontSize: '18px' }}>{customer.orders_count || 0}</div>
                <div className="dashboard-kpi-label" style={{ fontSize: '10px' }}>Orders</div>
              </div>
            </div>
            <div className="dashboard-kpi-card" style={{ padding: '12px 16px' }}>
              <div className="dashboard-kpi-icon" style={{ width: '32px', height: '32px', background: 'var(--color-success-bg)' }}>
                <Calculator size={14} color="var(--color-success-text)" />
              </div>
              <div className="dashboard-kpi-body">
                <div className="dashboard-kpi-value" style={{ fontSize: '18px' }}>{formatMoney(customer.orders_sum_total || 0)}</div>
                <div className="dashboard-kpi-label" style={{ fontSize: '10px' }}>Value</div>
              </div>
            </div>
          </div>

          <form id="customer-edit-form" className="product-editor-form" onSubmit={(e) => { e.preventDefault(); onSave(formData); }}>
            <section className="product-editor-section">
              <h3 className="product-editor-section-title">
                <User size={16} /> Basic Information
              </h3>
              <div className="field-grid">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email (Read Only)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--color-surface-3)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                  <Mail size={14} /> {customer.email}
                </div>
              </div>
              <div className="field-grid">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555-000-0000"
                  />
                </div>
              </div>
            </section>

            <section className="product-editor-section">
              <h3 className="product-editor-section-title">
                <MapPin size={16} /> Shipping Address
              </h3>
              <div className="form-group">
                <label className="form-label">Location Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData?.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  placeholder="Home, Office, etc."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address Line 1</label>
                <input
                  type="text"
                  className="input"
                  value={formData?.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                />
              </div>
              <div className="field-grid">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State / Province</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>
              <div className="field-grid">
                <div className="form-group">
                  <label className="form-label">Postal Code</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    className="input"
                    value={formData?.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <section className="product-editor-section">
              <h3 className="product-editor-section-title">
                <Clock size={16} /> Preferences & History
              </h3>
              <div className="form-group">
                <label className="form-label">Timezone</label>
                <input
                  type="text"
                  className="input"
                  value={formData?.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="UTC / America/New_York"
                />
              </div>
              <div className="dashboard-product-list" style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>History</div>
                <div className="dashboard-product-row">
                  <div className="dashboard-product-info">
                    <div className="dashboard-product-name">Registered On</div>
                    <div className="dashboard-product-qty">{new Date(customer.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="dashboard-product-row">
                  <div className="dashboard-product-info">
                    <div className="dashboard-product-name">Last Active</div>
                    <div className="dashboard-product-qty">{customer.updated_at ? new Date(customer.updated_at).toLocaleDateString() : 'Unknown'}</div>
                  </div>
                </div>
              </div>
            </section>
          </form>
        </div>

        <footer className="product-editor-footer">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" form="customer-edit-form" className="button button-primary" disabled={isSaving}>
            {isSaving ? 'Saving Changes...' : 'Save Customer'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default CustomerDetailsPanel
