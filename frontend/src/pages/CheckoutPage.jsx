import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

    setForm((current) => ({
      ...current,
      name: profile.name ?? current.name,
      phone: profile.phone ?? current.phone,
      line1: profile.address_line1 ?? current.line1,
      line2: profile.address_line2 ?? current.line2,
      city: profile.city ?? current.city,
      state: profile.state ?? current.state,
      postal_code: profile.postal_code ?? current.postal_code,
      country: profile.country ?? current.country,
      timezone: profile.timezone ?? current.timezone,
      location_name: profile.location_name ?? current.location_name,
      latitude: profile.latitude ?? current.latitude,
      longitude: profile.longitude ?? current.longitude,
    }))
  }, [profile])

  async function handleCheckout() {
    if (items.length === 0) {
      setError('Your cart is empty. Add a product before placing a COD order.')
      return
    }

    if (!form.name.trim() || !form.line1.trim() || !form.city.trim() || !form.postal_code.trim()) {
      setError('Please complete full name, address line 1, city, and postal code before placing your order.')
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
          <h3>Delivery address</h3>
          <div className="field-grid" style={{ marginTop: '14px' }}>
            <input
              className="input"
              placeholder="Full name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <input
              className="input"
              placeholder="Phone number"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <input
              className="input"
              placeholder="Address line 1"
              value={form.line1}
              onChange={(event) => setForm({ ...form, line1: event.target.value })}
            />
            <input
              className="input"
              placeholder="Address line 2"
              value={form.line2}
              onChange={(event) => setForm({ ...form, line2: event.target.value })}
            />
            <input
              className="input"
              placeholder="City"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
            <input
              className="input"
              placeholder="State / Province"
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value })}
            />
            <input
              className="input"
              placeholder="Postal code"
              value={form.postal_code}
              onChange={(event) => setForm({ ...form, postal_code: event.target.value })}
            />
            <input
              className="input"
              placeholder="Country code"
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value.toUpperCase() })}
            />
            <input
              className="input"
              placeholder="Location name"
              value={form.location_name}
              onChange={(event) => setForm({ ...form, location_name: event.target.value })}
            />
            <input
              className="input"
              placeholder="Timezone"
              value={form.timezone}
              onChange={(event) => setForm({ ...form, timezone: event.target.value })}
            />
          </div>
          {error ? <div className="notice error">{error}</div> : null}
          <button type="button" className="button button-primary" onClick={handleCheckout} disabled={loading || items.length === 0}>
            {loading ? 'Placing order...' : 'Place COD order'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default CheckoutPage