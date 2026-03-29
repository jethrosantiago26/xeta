function SetupPage() {
  return (
    <main className="auth-landing">
      <section className="auth-card">
        <p className="eyebrow" style={{ textAlign: 'center', marginBottom: '6px' }}>Setup Required</p>
        <h1>XETA</h1>
        <p style={{ marginTop: '6px', marginBottom: '24px' }}>
          Add <code style={{ fontFamily: 'monospace', background: 'var(--color-tag-bg)', color: 'var(--color-text-primary)', padding: '2px 7px', borderRadius: '4px', fontSize: '12px' }}>VITE_CLERK_PUBLISHABLE_KEY</code> to your
          environment to mount the authenticated app shell.
        </p>
        <div className="notice" style={{ textAlign: 'left' }}>
          The API client is ready for Laravel at{' '}
          <code style={{ fontFamily: 'monospace', background: 'var(--color-notice-bg)', color: 'var(--color-text-primary)', padding: '2px 5px', borderRadius: '3px', fontSize: '12px' }}>VITE_API_URL</code>.
        </div>
        <div className="notice" style={{ textAlign: 'left', marginTop: '10px' }}>
          Leaflet location mapping is enabled by default. Allow browser geolocation
          access to auto-fill address details during profile setup.
        </div>
      </section>
    </main>
  )
}

export default SetupPage