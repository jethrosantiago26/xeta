import { useEffect, useRef, useState } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../context/SessionContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import {
  prefetchOrdersRoute,
  prefetchShopRoutes,
  prefetchSupportRoutes,
} from '../../lib/routePrefetch.js'

const adminCoreMenu = [
  { to: '/admin', label: 'Overview' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/support', label: 'Support' },
  { to: '/admin/notifications', label: 'Notifications' },
]

const adminCommerceMenu = [
  { to: '/admin/orders', label: 'Orders', note: 'Queue and fulfillment' },
  { to: '/admin/customers', label: 'Customers', note: 'Segmentation and support' },
  { to: '/admin/inventory', label: 'Inventory', note: 'Stock and low-level alerts' },
  { to: '/admin/reviews', label: 'Reviews', note: 'Moderation pipeline' },
]

const adminSystemMenu = [
  { to: '/account', label: 'My Account' },
]

const customerBreadcrumbLabels = {
  products: 'Products',
  wishlist: 'Wishlist',
  cart: 'Cart',
  checkout: 'Checkout',
  orders: 'Orders',
  support: 'Support',
  faq: 'FAQ',
  account: 'Account',
}

function formatCustomerBreadcrumbLabel(segment) {
  const decodedSegment = (() => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })()

  const normalized = decodedSegment.replace(/[-_]+/g, ' ').trim()

  if (!normalized) {
    return 'Page'
  }

  return normalized
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2) {
        return word.toUpperCase()
      }

      return `${word[0].toUpperCase()}${word.slice(1)}`
    })
    .join(' ')
}

function CustomerBreadcrumbs({ pathname }) {
  if (pathname === '/' || pathname === '/sign-in' || pathname === '/post-auth') {
    return null
  }

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = [
    {
      label: 'Home',
      to: segments.length ? '/' : undefined,
    },
  ]

  let cumulativePath = ''

  segments.forEach((segment, index) => {
    cumulativePath += `/${segment}`
    const isLast = index === segments.length - 1

    crumbs.push({
      label: customerBreadcrumbLabels[segment] ?? formatCustomerBreadcrumbLabel(segment),
      to: isLast ? undefined : cumulativePath,
    })
  })

  return (
    <div className="customer-breadcrumb-wrap">
      <nav className="customer-breadcrumb" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="customer-breadcrumb-item">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {crumb.to ? <NavLink to={crumb.to}>{crumb.label}</NavLink> : <span aria-current="page">{crumb.label}</span>}
          </span>
        ))}
      </nav>
    </div>
  )
}

function AppLayout() {
  const { profile, loading, isSignedIn } = useSession()
  const isAdmin = profile?.role === 'admin'
  const { isDark, toggleTheme } = useTheme()

  // Avoid flashing customer navigation while role is still being resolved.
  if (isSignedIn && loading) {
    return (
      <div className="page-shell">
        <header className="site-header">
          <div className="header-row customer-header-row">
            <NavLink className="brand" to="/">
              <img className="brand-logo" src="/images/xeta-logo.svg" alt="" aria-hidden="true" />
              <span className="sr-only">XETA</span>
            </NavLink>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    )
  }

  if (isAdmin) {
    return <AdminLayout isDark={isDark} toggleTheme={toggleTheme} />
  }

  return <CustomerLayout isDark={isDark} toggleTheme={toggleTheme} />
}

function AdminLayout({ isDark, toggleTheme }) {
  return (
    <div className="page-shell admin-shell">
      <header className="site-header">
        <div className="header-row">
          <NavLink className="brand" to="/admin">
            <img className="brand-logo" src="/images/xeta-logo.svg" alt="" aria-hidden="true" />
            <span className="sr-only">XETA</span>
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
              <UserButton afterSignOutUrl="/" />
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
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `admin-side-link${isActive ? ' active' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <span>{item.label}</span>
                <small>{item.note}</small>
              </NavLink>
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

function CustomerLayout({ isDark, toggleTheme }) {
  const location = useLocation()
  const [supportMenuOpen, setSupportMenuOpen] = useState(false)
  const [supportMenuPinned, setSupportMenuPinned] = useState(false)
  const supportMenuRef = useRef(null)

  const supportMenuActive = location.pathname === '/support' || location.pathname === '/faq'
  const isLandingPage = location.pathname === '/'

  useEffect(() => {
    function handleDocumentClick(event) {
      if (supportMenuRef.current && !supportMenuRef.current.contains(event.target)) {
        setSupportMenuOpen(false)
        setSupportMenuPinned(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [])

  function closeSupportMenu() {
    setSupportMenuOpen(false)
    setSupportMenuPinned(false)
  }

  return (
    <div className="page-shell">
      <header className={`site-header site-header-landing${isLandingPage ? ' site-header-home' : ''}`}>
        <div className="header-row customer-header-row">
          <NavLink className="brand" to="/">
            <img className="brand-logo" src="/images/xeta-logo.svg" alt="" aria-hidden="true" />
            <span className="sr-only">XETA</span>
          </NavLink>

          <nav className="nav-links">
            <NavLink
              to="/products"
              onMouseEnter={prefetchShopRoutes}
              onFocus={prefetchShopRoutes}
              onTouchStart={prefetchShopRoutes}
            >
              Shop
            </NavLink>
            <div
              className={`nav-dropdown${supportMenuOpen ? ' open' : ''}`}
              ref={supportMenuRef}
              onMouseEnter={() => {
                prefetchSupportRoutes()

                if (!supportMenuPinned) {
                  setSupportMenuOpen(true)
                }
              }}
              onFocusCapture={prefetchSupportRoutes}
              onTouchStart={prefetchSupportRoutes}
              onMouseLeave={() => {
                if (!supportMenuPinned) {
                  setSupportMenuOpen(false)
                }
              }}
            >
              <button
                type="button"
                className={`nav-dropdown-trigger${supportMenuActive ? ' active' : ''}`}
                aria-expanded={supportMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setSupportMenuPinned((value) => {
                    const nextPinned = !value
                    setSupportMenuOpen(nextPinned)

                    return nextPinned
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    closeSupportMenu()
                  }
                }}
              >
                Support
              </button>

              {supportMenuOpen ? (
                <div className="nav-dropdown-menu" role="menu" aria-label="Support links">
                  <NavLink to="/support" role="menuitem" onClick={closeSupportMenu}>
                    Support Center
                  </NavLink>
                  <NavLink to="/faq" role="menuitem" onClick={closeSupportMenu}>
                    FAQ
                  </NavLink>
                </div>
              ) : null}
            </div>
            <NavLink
              to="/orders"
              onMouseEnter={prefetchOrdersRoute}
              onFocus={prefetchOrdersRoute}
              onTouchStart={prefetchOrdersRoute}
            >
              Orders
            </NavLink>
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
                <NavLink className="icon-nav-button" to="/wishlist" aria-label="Wishlist" title="Wishlist">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 20.2 10.7 19C5.8 14.5 2.5 11.5 2.5 7.8A4.8 4.8 0 0 1 7.3 3a5.3 5.3 0 0 1 4.7 2.6A5.3 5.3 0 0 1 16.7 3a4.8 4.8 0 0 1 4.8 4.8c0 3.7-3.3 6.7-8.2 11.2Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </NavLink>

                <NavLink className="icon-nav-button" to="/cart" aria-label="Cart" title="Cart">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="10" cy="19" r="1.5" fill="currentColor" />
                    <circle cx="17" cy="19" r="1.5" fill="currentColor" />
                  </svg>
                </NavLink>

                <NavLink
                  className={({ isActive }) => `icon-nav-button${isActive ? ' active' : ''}`}
                  to="/account"
                  aria-label="Account"
                  title="Account"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09A1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                  </svg>
                </NavLink>

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
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className={`customer-main${isLandingPage ? '' : ' customer-main-offset'}`}>
        <CustomerBreadcrumbs pathname={location.pathname} />
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-row">
          <div>
            <img className="brand-logo brand-logo-footer" src="/images/xeta-logo.svg" alt="XETA" />
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-footer-text)', lineHeight: 1.6 }}>
              Refined peripherals for focused desks.<br />
              Clerk auth · Laravel API · Cash on delivery.
            </p>
          </div>
          <div className="footer-links">
            <p style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: 'var(--color-footer-text)' }}>Explore</p>
            <NavLink to="/products">Catalog</NavLink>
            <NavLink to="/cart">Cart</NavLink>
            <NavLink to="/checkout">Checkout</NavLink>
          </div>
          <div className="footer-links">
            <p style={{ margin: '0 0 10px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: 'var(--color-footer-text)' }}>Account</p>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/wishlist">Wishlist</NavLink>
            <NavLink to="/account">Profile</NavLink>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppLayout
