import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useSession } from '../context/SessionContext.jsx'
import { placeCashOnDeliveryOrder } from '../lib/api.js'
import { formatMoney } from '../lib/format.js'

function extractCheckoutError(error) {
  const payload = error?.response?.data
  const status = error?.response?.status

  if (payload?.errors && typeof payload.errors === 'object') {
    const firstError = Object.values(payload.errors)?.[0]
    if (Array.isArray(firstError) && firstError[0]) {
      return firstError[0]
    }
  }

  if (status === 401) {
    return 'Your session expired. Please sign out and sign in again, then retry checkout.'
  }

  return payload?.message || 'Your cash on delivery order could not be placed right now.'
}

function CheckoutPage() {
  const { items, totals } = useCart()
  const { profile } = useSession()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'PH',
    timezone: '',
    location_name: '',
    latitude: '',
    longitude: '',
  })

  useEffect(() => {
    if (!profile) {
      return
    }

    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      line1: profile.address_line1 ?? '',
      line2: profile.address_line2 ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      postal_code: profile.postal_code ?? '',
      country: profile.country ?? 'PH',
      timezone: profile.timezone ?? '',
      location_name: profile.location_name ?? '',
      latitude: profile.latitude ?? '',
      longitude: profile.longitude ?? '',
    })
  }, [profile])

  const addressMissing = !form.line1.trim() || !form.city.trim() || !form.postal_code.trim()

  async function handleCheckout() {
    if (items.length === 0) {
      setError('Your cart is empty. Add a product before placing a COD order.')
      return
    }

    if (!form.name.trim() || addressMissing) {
      setError('Your delivery address is incomplete. Please update your profile first.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const latitudeValue = form.latitude === '' ? null : Number(form.latitude)
      const longitudeValue = form.longitude === '' ? null : Number(form.longitude)

      await placeCashOnDeliveryOrder({
        shipping_address: {
          ...form,
          name: form.name.trim(),
          line1: form.line1.trim(),
          line2: form.line2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postal_code: form.postal_code.trim(),
          country: (form.country || 'PH').trim().toUpperCase().slice(0, 2),
          timezone: form.timezone.trim(),
          location_name: form.location_name.trim(),
          latitude: Number.isFinite(latitudeValue) ? latitudeValue : null,
          longitude: Number.isFinite(longitudeValue) ? longitudeValue : null,
        },
      })
      navigate('/orders')
    } catch (requestError) {
      setError(extractCheckoutError(requestError))
    } finally {
      setLoading(false)
    }
  }

  const SyncedLabel = () => (
    <span className="pill pill-info" style={{ fontSize: '10px', padding: '2px 6px' }}>Synced</span>
  )

  return (
    <div className="page-grid">
      <section className="content-card">
        <p className="eyebrow-inline">Checkout</p>
        <h1>Cash on delivery</h1>
        <p className="muted">Place your order now and pay when the parcel arrives.</p>
      </section>

      <section className="grid cards">
        <div className="summary-card">
          <h3>Order total</h3>
          <div className="divider" />
          <p className="price">{formatMoney(totals.total)}</p>
          <p className="muted">Taxes and shipping are calculated by the server.</p>
          <p className="caption">Items in cart: {items.length}</p>
        </div>
        <div className="summary-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0 }}>Delivery address</h3>
            <span className="pill pill-info" style={{ fontSize: '10px', padding: '2px 8px' }}>
              Synced from profile
            </span>
          </div>
          <p className="muted" style={{ margin: '0 0 14px', fontSize: '13px' }}>
            To update your delivery details, go to your{' '}
            <Link to="/account" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              Profile
            </Link>.
          </p>

          {addressMissing ? (
            <div className="notice error" style={{ marginBottom: '16px' }}>
              Your delivery address is incomplete. Please{' '}
              <Link to="/account" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 600 }}>
                update your profile
              </Link>{' '}
              with a full address before checking out.
            </div>
          ) : null}

          <div className="field-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Full name <SyncedLabel />
              </label>
              <input className="input input-readonly" readOnly value={form.name} placeholder="—" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Phone number <SyncedLabel />
              </label>
              <input className="input input-readonly" readOnly value={form.phone} placeholder="—" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Address line 1 <SyncedLabel />
              </label>
              <input className="input input-readonly" readOnly value={form.line1} placeholder="—" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Address line 2 <SyncedLabel />
              </label>
              <input className="input input-readonly" readOnly value={form.line2} placeholder="—" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  City <SyncedLabel />
                </label>
                <input className="input input-readonly" readOnly value={form.city} placeholder="—" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  State / Province <SyncedLabel />
                </label>
                <input className="input input-readonly" readOnly value={form.state} placeholder="—" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Postal code <SyncedLabel />
                </label>
                <input className="input input-readonly" readOnly value={form.postal_code} placeholder="—" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Country <SyncedLabel />
                </label>
                <input className="input input-readonly" readOnly value={form.country} placeholder="—" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Location name <SyncedLabel />
              </label>
              <input className="input input-readonly" readOnly value={form.location_name} placeholder="—" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                Timezone <SyncedLabel />
              </label>
              <input className="input input-readonly" readOnly value={form.timezone} placeholder="—" />
            </div>
          </div>
          {error ? <div className="notice error" style={{ marginTop: '16px' }}>{error}</div> : null}
          <button
            type="button"
            className="button button-primary"
            style={{ marginTop: '16px', width: '100%' }}
            onClick={handleCheckout}
            disabled={loading || items.length === 0 || addressMissing}
          >
            {loading ? 'Placing order...' : 'Place COD order'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default CheckoutPage