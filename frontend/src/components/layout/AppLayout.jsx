import { useEffect, useRef, useState } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../../context/SessionContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'

function AppLayout() {
  const { profile } = useSession()
  const isAdmin = profile?.role === 'admin'
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsMenuRef = useRef(null)

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!settingsMenuRef.current) {
        return
      }

      if (!settingsMenuRef.current.contains(event.target)) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [])

  const adminCoreMenu = [
    { to: '/admin', label: 'Overview' },
    { to: '/admin/products', label: 'Products' },
  ]

  const adminCommerceMenu = [
    { label: 'Orders', note: 'Queue and fulfillment' },
    { label: 'Customers', note: 'Segmentation and support' },
    { label: 'Inventory', note: 'Stock and low-level alerts' },
    { label: 'Reviews', note: 'Moderation pipeline' },
    { label: 'Analytics', note: 'Revenue and conversion' },
  ]

  const adminSystemMenu = [
    { to: '/account', label: 'Profile' },
    { to: '/settings', label: 'Settings' },
  ]

  if (isAdmin) {
    return (
      <div className="page-shell admin-shell">
        <header className="site-header">
          <div className="header-row">
            <NavLink className="brand" to="/admin">
              <strong>XETA</strong>
            </NavLink>

            <div className="actions" style={{ gap: '8px' }}>
              <SignedOut>
                <SignInButton mode="modal">
                  <button type="button" className="button button-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className="header-action-icons" aria-label="Quick actions">
                  <button
                    type="button"
                    className="icon-nav-button"
                    onClick={toggleTheme}
                    aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {isDark ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M20.4 14.6A8.5 8.5 0 1 1 9.4 3.6a7 7 0 1 0 11 11Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
                <UserButton afterSignOutUrl="/">
                  <UserButton.MenuItems>
                    <UserButton.Action label="Profile" onClick={() => navigate('/account')} />
                    <UserButton.Action label="Settings" onClick={() => navigate('/settings')} />
                  </UserButton.MenuItems>
                </UserButton>
              </SignedIn>
            </div>
          </div>
        </header>

        <div className="admin-frame">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-group">
              <p className="admin-sidebar-title">Core</p>
              {adminCoreMenu.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/admin'}
                  className={({ isActive }) => `admin-side-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="admin-sidebar-group">
              <p className="admin-sidebar-title">Commerce</p>
              {adminCommerceMenu.map((item) => (
                <div key={item.label} className="admin-side-link disabled" aria-disabled="true">
                  <span>{item.label}</span>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>

            <div className="admin-sidebar-group">
              <p className="admin-sidebar-title">System</p>
              {adminSystemMenu.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `admin-side-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </aside>

          <main className="admin-main">
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="header-row customer-header-row">
          <NavLink className="brand" to="/">
            <strong>XETA</strong>
          </NavLink>

          <nav className="nav-links">
            <details className="nav-dropdown">
              <summary>Shop</summary>
              <div className="nav-dropdown-menu" role="menu" aria-label="Shop categories">
                <NavLink to="/products" role="menuitem">
                  All Products
                </NavLink>
                <NavLink to="/products?category=mice" role="menuitem">
                  Mice
                </NavLink>
                <NavLink to="/products?category=keyboards" role="menuitem">
                  Keyboards
                </NavLink>
                <NavLink to="/products?category=mousepads" role="menuitem">
                  Mouse Pads
                </NavLink>
              </div>
            </details>
            <NavLink to="/orders">Orders</NavLink>
            <a href="mailto:support@xeta.store">Support</a>
          </nav>

          <div className="actions" style={{ gap: '8px' }}>
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="button button-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="header-action-icons" aria-label="Quick actions">
                <NavLink className="icon-nav-button" to="/cart" aria-label="Cart" title="Cart">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="10" cy="19" r="1.5" fill="currentColor" />
                    <circle cx="17" cy="19" r="1.5" fill="currentColor" />
                  </svg>
                </NavLink>

                <div className="settings-dropdown" ref={settingsMenuRef}>
                  <button
                    type="button"
                    className="icon-nav-button"
                    aria-label="Settings menu"
                    title="Settings"
                    aria-expanded={settingsOpen}
                    onClick={() => setSettingsOpen((value) => !value)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      <path d="m19.4 12.9-.2-1.8 1.6-1.3-1.7-2.9-2 .6-1.4-1-1.1-1.8h-3.2L10.3 6l-1.4 1-2-.6-1.7 2.9 1.6 1.3-.2 1.8-1.4 1.2 1.7 2.9 1.9-.5 1.5 1.1 1 1.7h3.2l1-1.7 1.5-1.1 1.9.5 1.7-2.9-1.4-1.2Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {settingsOpen ? (
                    <div className="settings-dropdown-menu" role="menu" aria-label="Settings">
                      <NavLink className="settings-dropdown-item" to="/settings" role="menuitem" onClick={() => setSettingsOpen(false)}>
                        Settings
                      </NavLink>
                      <NavLink className="settings-dropdown-item" to="/account" role="menuitem" onClick={() => setSettingsOpen(false)}>
                        Profile
                      </NavLink>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="icon-nav-button"
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M20.4 14.6A8.5 8.5 0 1 1 9.4 3.6a7 7 0 1 0 11 11Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              <UserButton afterSignOutUrl="/">
                <UserButton.MenuItems>
                  <UserButton.Action label="Profile" onClick={() => navigate('/account')} />
                  <UserButton.Action label="Settings" onClick={() => navigate('/settings')} />
                </UserButton.MenuItems>
              </UserButton>
            </SignedIn>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-row">
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '15px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-primary)' }}>XETA</p>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Refined peripherals for focused desks.<br />
              Clerk auth · Laravel API · Cash on delivery.
            </p>
          </div>
          <div className="footer-links">
            <p style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: 'var(--color-text-muted)' }}>Explore</p>
            <NavLink to="/products">Catalog</NavLink>
            <NavLink to="/cart">Cart</NavLink>
            <NavLink to="/checkout">Checkout</NavLink>
          </div>
          <div className="footer-links">
            <p style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: 'var(--color-text-muted)' }}>Account</p>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/account">Profile</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppLayout
