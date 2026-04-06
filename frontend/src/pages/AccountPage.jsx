import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { updateProfile } from '../lib/api.js'
import {
  getBrowserCoordinates,
  reverseGeocodeCoordinates,
  searchAddressSuggestions,
} from '../lib/location.js'

const LocationPickerMap = lazy(() => import('../components/LocationPickerMap.jsx'))

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

const defaultSettings = {
  order_updates: true,
  security_alerts: true,
  marketing_emails: false,
  profile_visibility: 'private',
}

function AccountPage() {
  const { theme, setTheme, toggleTheme } = useTheme()
  const { profile, refreshProfile } = useSession()
  const isAdmin = profile?.role === 'admin'
  const [activeTab, setActiveTab] = useState('profile')

  const [settings, setSettings] = useState(defaultSettings)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [settingsError, setSettingsError] = useState('')

  async function handleSaveSettings() {
    setSettingsSaving(true)
    setSettingsError('')
    setSettingsMessage('')

    try {
      await updateProfile({
        order_updates: settings.order_updates,
        security_alerts: settings.security_alerts,
        marketing_emails: settings.marketing_emails,
      })

      await refreshProfile()
      setSettingsMessage('Settings saved.')
      setTimeout(() => setSettingsMessage(''), 3000)
    } catch (saveError) {
      setSettingsError(extractRequestError(saveError, 'Notification settings could not be saved right now.'))
    } finally {
      setSettingsSaving(false)
    }
  }

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
    username: '',
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
  })

  useEffect(() => {
    if (!profile) {
      return
    }

    setSettings({
      ...defaultSettings,
      order_updates: profile.order_updates ?? defaultSettings.order_updates,
      security_alerts: profile.security_alerts ?? defaultSettings.security_alerts,
      marketing_emails: profile.marketing_emails ?? defaultSettings.marketing_emails,
    })

    setForm({
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
      username: profile.username ?? '',
      phone: isAdmin ? '' : (profile.phone ?? ''),
      address_line1: isAdmin ? '' : (profile.address_line1 ?? ''),
      address_line2: isAdmin ? '' : (profile.address_line2 ?? ''),
      city: profile.city ?? '',
      state: profile.state ?? '',
      postal_code: profile.postal_code ?? '',
      country: profile.country ?? 'PH',
      timezone: profile.timezone ?? '',
      location_name: profile.location_name ?? '',
      latitude: profile.latitude ?? '',
      longitude: profile.longitude ?? '',
      location_source: profile.location_source ?? '',
    })
  }, [profile, isAdmin])

  useEffect(() => {
    if (isAdmin && activeTab !== 'profile') {
      setActiveTab('profile')
    }
  }, [activeTab, isAdmin])

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
    const firstName = form.first_name.trim()
    const lastName = form.last_name.trim()

    if (!firstName) {
      setError('First name is required before saving your profile.')
      setMessage('')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const latitudeValue = form.latitude === '' ? null : Number(form.latitude)
      const longitudeValue = form.longitude === '' ? null : Number(form.longitude)
      const fullName = [firstName, lastName].filter(Boolean).join(' ')

      await updateProfile({
        ...form,
        name: fullName,
        first_name: firstName,
        last_name: lastName,
        phone: isAdmin ? null : form.phone.trim(),
        address_line1: isAdmin ? '' : form.address_line1.trim(),
        address_line2: isAdmin ? '' : form.address_line2.trim(),
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
        <div className="section-label account-hero-heading" style={{ marginBottom: '16px' }}>
          <div>
            <p className="eyebrow-inline">Account</p>
            <h1>Your dashboard</h1>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0px' }}>
          <button
            className={`tab-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            style={{
              background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer',
              color: activeTab === 'profile' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--color-primary)' : '2px solid transparent',
              fontWeight: 600, fontSize: '0.9rem'
            }}
          >
            Profile
          </button>
          {!isAdmin ? (
            <button
              className={`tab-link ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              style={{
                background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer',
                color: activeTab === 'settings' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: activeTab === 'settings' ? '2px solid var(--color-primary)' : '2px solid transparent',
                fontWeight: 600, fontSize: '0.9rem'
              }}
            >
              Preferences & Settings
            </button>
          ) : null}
        </div>
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

        {activeTab === 'profile' || isAdmin ? (
          <section className="content-card account-form-card">
            <div className="section-label">
              <div>
                <p className="eyebrow-inline">Personal details</p>
                <h2>{isAdmin ? 'Profile information' : 'Billing, shipping, and contact information'}</h2>
              </div>
              <div className="section-rule" aria-hidden="true" />
            </div>

            <div className="field-grid account-grid account-grid-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="account-grid account-grid-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="stack" style={{ gap: '5px' }}>
                  <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    First name <span className="pill pill-info" style={{ fontSize: '10px', padding: '2px 6px' }}>Synced</span>
                  </label>
                  <input
                    className="input input-readonly"
                    readOnly
                    placeholder="First name"
                    value={form.first_name}
                  />
                </div>
                <div className="stack" style={{ gap: '5px' }}>
                  <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    Last name <span className="pill pill-info" style={{ fontSize: '10px', padding: '2px 6px' }}>Synced</span>
                  </label>
                  <input
                    className="input input-readonly"
                    readOnly
                    placeholder="Last name"
                    value={form.last_name}
                  />
                </div>
              </div>

              <div className="stack" style={{ gap: '5px' }}>
                <label className="caption" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Username <span className="pill pill-info" style={{ fontSize: '10px', padding: '2px 6px' }}>Synced</span>
                </label>
                <input
                  className="input input-readonly"
                  readOnly
                  placeholder="Username"
                  value={form.username}
                />
              </div>

              {!isAdmin ? (
                <div className="stack" style={{ gap: '5px' }}>
                  <label className="caption">Phone number</label>
                  <input
                    className="input"
                    placeholder="Phone number"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </div>
              ) : null}
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

              {!isAdmin ? (
                <div className="stack" style={{ gap: '5px' }}>
                  <label className="caption">Address line 2</label>
                  <input
                    className="input"
                    placeholder="Floor, suite, apt (optional)"
                    value={form.address_line2}
                    onChange={(event) => setForm({ ...form, address_line2: event.target.value })}
                  />
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
                <Suspense fallback={<div className="notice">Loading map...</div>}>
                  <LocationPickerMap
                    latitude={hasMapPosition ? parsedLatitude : undefined}
                    longitude={hasMapPosition ? parsedLongitude : undefined}
                    onSelect={handleMapSelect}
                  />
                </Suspense>
              </div>
            ) : null}

            {message ? <div className="notice">{message}</div> : null}
            {error ? <div className="notice error">{error}</div> : null}
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            <article className="content-card settings-card">
              <h3>Appearance</h3>
              <p className="muted">Use an Apple-style adaptive theme across the app shell.</p>
              <div className="field-grid settings-grid">
                <select
                  className="select"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                >
                  <option value="dark">Dark mode</option>
                  <option value="light">Light mode</option>
                </select>
                <button type="button" className="button button-secondary" onClick={toggleTheme}>
                  Toggle theme
                </button>
              </div>
            </article>

            <article className="content-card settings-card">
              <h3>Notifications</h3>
              <div className="stack" style={{ gap: '10px' }}>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={settings.order_updates}
                    onChange={(event) => setSettings({ ...settings, order_updates: event.target.checked })}
                  />
                  <span>Order updates</span>
                </label>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={settings.security_alerts}
                    onChange={(event) => setSettings({ ...settings, security_alerts: event.target.checked })}
                  />
                  <span>Security alerts</span>
                </label>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={settings.marketing_emails}
                    onChange={(event) => setSettings({ ...settings, marketing_emails: event.target.checked })}
                  />
                  <span>Marketing emails</span>
                </label>
              </div>
            </article>
            <section className="content-card settings-actions">
              <button type="button" className="button button-primary" onClick={handleSaveSettings} disabled={settingsSaving}>
                {settingsSaving ? 'Saving settings...' : 'Save settings'}
              </button>
              {settingsMessage ? <div className="notice success">{settingsMessage}</div> : null}
              {settingsError ? <div className="notice error">{settingsError}</div> : null}
            </section>
          </div>
        )}
      </section>
    </div>
  )
}

export default AccountPage