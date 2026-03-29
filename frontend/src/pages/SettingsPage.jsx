import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

const SETTINGS_STORAGE_KEY = 'xeta:user-settings:v1'

const defaultSettings = {
  order_updates: true,
  security_alerts: true,
  marketing_emails: false,
  profile_visibility: 'private',
}

function SettingsPage() {
  const { theme, setTheme, toggleTheme } = useTheme()
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)

    if (!saved) {
      return defaultSettings
    }

    try {
      const parsed = JSON.parse(saved)
      return { ...defaultSettings, ...parsed }
    } catch {
      return defaultSettings
    }
  })
  const [message, setMessage] = useState('')

  function handleSave() {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    setMessage('Settings saved.')
  }

  return (
    <div className="page-grid settings-page">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your appearance, notifications, and privacy preferences."
      />

      <section className="grid cards">
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

        <article className="content-card settings-card">
          <h3>Privacy</h3>
          <p className="muted">Control how your account appears in shared experiences.</p>
          <select
            className="select"
            value={settings.profile_visibility}
            onChange={(event) => setSettings({ ...settings, profile_visibility: event.target.value })}
          >
            <option value="private">Profile visibility: private</option>
            <option value="friends">Profile visibility: friends</option>
            <option value="public">Profile visibility: public</option>
          </select>
        </article>
      </section>

      <section className="content-card settings-actions">
        <button type="button" className="button button-primary" onClick={handleSave}>
          Save settings
        </button>
        {message ? <div className="notice success">{message}</div> : null}
      </section>
    </div>
  )
}

export default SettingsPage
