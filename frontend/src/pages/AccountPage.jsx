import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'
import { updateProfile } from '../lib/api.js'
import LocationPickerMap from '../components/LocationPickerMap.jsx'
import {
  getBrowserCoordinates,
  reverseGeocodeCoordinates,
  searchAddressSuggestions,
} from '../lib/location.js'

function extractRequestError(error, fallbackMessage) {
  const payload = error?.response?.data

  if (payload?.errors && typeof payload.errors === 'object') {
    const firstError = Object.values(payload.errors)?.[0]
    if (Array.isArray(firstError) && firstError[0]) {
      return firstError[0]
    }
  }

  return payload?.message || fallbackMessage
}

function parseCoordinate(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function splitFullName(name) {
  const trimmed = (name || '').trim()

  if (!trimmed) {
    return { firstName: '', lastName: '' }
  }

  const parts = trimmed.split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ')

  return { firstName, lastName }
}

function AccountPage() {
  const { profile, refreshProfile } = useSession()
  const isAdmin = profile?.role === 'admin'
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [addressOpen, setAddressOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'PH',
    timezone: '',
    location_name: '',
    latitude: '',
    longitude: '',
    location_source: '',
    preferred_contact_method: 'email',
  })

  useEffect(() => {
    if (!profile) {
      return
    }

    const { firstName, lastName } = splitFullName(profile.name)
    const mergedAddress = isAdmin
      ? ''
      : [profile.address_line1, profile.address_line2].filter(Boolean).join(', ')

    setForm({
      first_name: firstName,
      last_name: lastName,
      phone: profile.phone ?? '',
      address_line1: mergedAddress,
      address_line2: '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      postal_code: profile.postal_code ?? '',
      country: profile.country ?? 'PH',
      timezone: profile.timezone ?? '',
      location_name: profile.location_name ?? '',
      latitude: profile.latitude ?? '',
      longitude: profile.longitude ?? '',
      location_source: profile.location_source ?? '',
      preferred_contact_method: profile.preferred_contact_method ?? 'email',
    })
  }, [profile, isAdmin])

  useEffect(() => {
    if (isAdmin) {
      setAddressSuggestions([])
      setAddressOpen(false)
      return
    }

    const query = form.address_line1.trim()

    if (query.length < 4) {
      setAddressSuggestions([])
      setAddressOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setAddressSearching(true)
        const suggestions = await searchAddressSuggestions(query, 5)
        setAddressSuggestions(suggestions)
        setAddressOpen(suggestions.length > 0)
      } catch {
        setAddressSuggestions([])
        setAddressOpen(false)
      } finally {
        setAddressSearching(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [form.address_line1, isAdmin])

  const hasSavedLocation = useMemo(() => {
    return Boolean(profile?.location_name || profile?.city || profile?.country)
  }, [profile])

  const parsedLatitude = parseCoordinate(form.latitude)
  const parsedLongitude = parseCoordinate(form.longitude)
  const hasMapPosition = parsedLatitude !== null && parsedLongitude !== null

  async function applyCoordinates(latitude, longitude, source = 'leaflet_map', fillAddress = false) {
    const location = await reverseGeocodeCoordinates({ latitude, longitude })

    setForm((current) => ({
      ...current,
      address_line1: fillAddress ? (location.formatted_address || current.address_line1) : current.address_line1,
      address_line2: '',
      city: location.city || current.city,
      state: location.state || current.state,
      postal_code: location.postal_code || current.postal_code,
      country: (location.country_code || current.country || 'PH').toUpperCase(),
      timezone: current.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      location_name: location.formatted_address || current.location_name,
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
      location_source: source,
    }))
  }

  async function handleLocationLookup() {
    setLocationLoading(true)
    setError('')
    setMessage('')

    try {
      const { latitude, longitude } = await getBrowserCoordinates()
      try {
        await applyCoordinates(latitude, longitude, 'browser_geolocation', true)
        setMessage('Location detected and full address auto-filled.')
      } catch {
        setForm((current) => ({
          ...current,
          latitude: latitude.toFixed(7),
          longitude: longitude.toFixed(7),
          location_source: 'browser_geolocation',
        }))
        setMessage('Location detected, but address lookup is unavailable right now.')
      }
    } catch {
      setError('Location detection failed. Please allow browser location access or type it in manually.')
    } finally {
      setLocationLoading(false)
    }
  }

  async function handleMapSelect({ latitude, longitude }) {
    setError('')
    setMessage('')

    try {
      await applyCoordinates(latitude, longitude, 'leaflet_map_click', true)
      setMessage('Map location selected and fields updated.')
    } catch {
      setError('Map location could not be resolved. Please try another point.')
    }
  }

  function handleAddressSuggestionSelect(suggestion) {
    setForm((current) => ({
      ...current,
      address_line1: suggestion.label,
      address_line2: '',
      city: suggestion.city || current.city,
      state: suggestion.state || current.state,
      postal_code: suggestion.postal_code || current.postal_code,
      country: (suggestion.country_code || current.country || 'PH').toUpperCase(),
      latitude: Number.isFinite(suggestion.latitude) ? suggestion.latitude.toFixed(7) : current.latitude,
      longitude: Number.isFinite(suggestion.longitude) ? suggestion.longitude.toFixed(7) : current.longitude,
      location_name: suggestion.label || current.location_name,
      location_source: 'address_autocomplete',
    }))

    setAddressOpen(false)
    setAddressSuggestions([])
    setMessage('Address selected and location details updated.')
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required before saving your profile.')
      setMessage('')
      return
    }

    if (form.first_name.trim().toLowerCase() === form.last_name.trim().toLowerCase()) {
      setError('First name and last name must be different.')
      setMessage('')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const latitudeValue = form.latitude === '' ? null : Number(form.latitude)
      const longitudeValue = form.longitude === '' ? null : Number(form.longitude)
      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`

      await updateProfile({
        ...form,
        name: fullName,
        address_line1: isAdmin ? '' : form.address_line1.trim(),
        address_line2: '',
        city: isAdmin ? '' : form.city,
        state: isAdmin ? '' : form.state,
        postal_code: isAdmin ? '' : form.postal_code,
        country: (form.country || '').trim().toUpperCase().slice(0, 2),
        latitude: isAdmin ? null : (Number.isFinite(latitudeValue) ? latitudeValue : null),
        longitude: isAdmin ? null : (Number.isFinite(longitudeValue) ? longitudeValue : null),
        location_name: isAdmin ? null : form.location_name,
        location_source: isAdmin ? null : form.location_source,
      })
      await refreshProfile()
      setMessage('Profile saved successfully.')
    } catch (saveError) {
      setError(extractRequestError(saveError, 'Your profile could not be saved right now.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-grid account-page">
      <section className="content-card account-hero">
        <div className="section-label account-hero-heading">
          <div>
            <p className="eyebrow-inline">Account</p>
            <h1>Your profile</h1>
          </div>
        </div>
        <p className="muted">
          Clerk identity is synchronized into Laravel users, and the profile form stores
          the personal details needed for checkout, shipping, and support.
        </p>
      </section>

      <section className="account-layout">
        <aside className="stack account-summary-panel">
          <div className="summary-card">
            <p className="caption">Profile</p>
            <h3>{profile?.name ?? 'Account name'}</h3>
            <p className="muted">{profile?.email}</p>
            <div className="divider" />
            <div className="summary-grid">
              <div>
                <p className="caption">Role</p>
                <strong>{profile?.role ?? 'Customer'}</strong>
              </div>
              <div>
                <p className="caption">Contact</p>
                <strong>{profile?.preferred_contact_method ?? 'email'}</strong>
              </div>
            </div>
          </div>

          {!isAdmin ? (
            <div className="summary-card">
              <h3>Saved location</h3>
              {hasSavedLocation ? (
                <div className="stack" style={{ gap: '10px' }}>
                  <p className="muted">{profile?.location_name ?? profile?.city ?? 'Saved location'}</p>
                  <div className="summary-grid">
                    <div>
                      <p className="caption">City</p>
                      <strong>{profile?.city ?? '—'}</strong>
                    </div>
                    <div>
                      <p className="caption">Country</p>
                      <strong>{profile?.country ?? '—'}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="muted">Use location detection or enter your address manually.</p>
              )}
            </div>
          ) : null}
        </aside>

        <section className="content-card account-form-card">
          <div className="section-label">
            <div>
              <p className="eyebrow-inline">Personal details</p>
              <h2>{isAdmin ? 'Profile information' : 'Billing, shipping, and contact information'}</h2>
            </div>
            <div className="section-rule" aria-hidden="true" />
          </div>

          <div className="field-grid account-grid account-grid-vertical">
            <select
              className="select"
              value={form.preferred_contact_method}
              onChange={(event) =>
                setForm({ ...form, preferred_contact_method: event.target.value })
              }
            >
              <option value="email">Preferred Contact: E-mail</option>
              <option value="phone">Preferred Contact: Phone</option>
            </select>
            <input
              className="input"
              placeholder="First name"
              value={form.first_name}
              onChange={(event) => setForm({ ...form, first_name: event.target.value })}
            />
            <input
              className="input"
              placeholder="Last name"
              value={form.last_name}
              onChange={(event) => setForm({ ...form, last_name: event.target.value })}
            />
            <input
              className="input"
              placeholder="Phone number"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            {!isAdmin ? (
              <div className="account-address-autocomplete">
                <input
                  className="input"
                  placeholder="Full address"
                  value={form.address_line1}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) {
                      setAddressOpen(true)
                    }
                  }}
                  onChange={(event) => {
                    setForm({ ...form, address_line1: event.target.value })
                    setAddressOpen(true)
                  }}
                />
                {addressSearching ? (
                  <p className="caption account-address-status">Searching address suggestions...</p>
                ) : null}
                {addressOpen && addressSuggestions.length > 0 ? (
                  <div className="account-address-suggestions" role="listbox" aria-label="Address suggestions">
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="account-address-option"
                        onClick={() => handleAddressSuggestionSelect(suggestion)}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="actions account-actions">
            {!isAdmin ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={handleLocationLookup}
                disabled={locationLoading}
              >
                {locationLoading ? 'Detecting location...' : 'Detect location'}
              </button>
            ) : null}
            <button type="button" className="button button-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving profile...' : 'Save profile'}
            </button>
          </div>

          {!isAdmin ? (
            <div className="stack" style={{ gap: '10px' }}>
              <p className="caption" style={{ margin: 0 }}>
                Map picker: click any point to fill city, country, and coordinates.
              </p>
              <LocationPickerMap
                latitude={hasMapPosition ? parsedLatitude : undefined}
                longitude={hasMapPosition ? parsedLongitude : undefined}
                onSelect={handleMapSelect}
              />
            </div>
          ) : null}

          {message ? <div className="notice">{message}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}
        </section>
      </section>
    </div>
  )
}

export default AccountPage