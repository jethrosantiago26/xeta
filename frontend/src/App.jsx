import { lazy, Suspense, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { SessionProvider } from './context/SessionContext.jsx'
import { WishlistProvider } from './context/WishlistContext.jsx'
import { useSession } from './context/SessionContext.jsx'
import SetupPage from './pages/SetupPage.jsx'
import { setApiAuthToken, setApiAuthTokenProvider } from './lib/api.js'
import './App.css'

const AccountPage = lazy(() => import('./pages/AccountPage.jsx'))

const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage.jsx'))
const AdminReviewsPage = lazy(() => import('./pages/AdminReviewsPage.jsx'))
const AdminSupportPage = lazy(() => import('./pages/AdminSupportPage.jsx'))
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage.jsx'))
const AdminCustomersPage = lazy(() => import('./pages/AdminCustomersPage.jsx'))
const AdminInventoryPage = lazy(() => import('./pages/AdminInventoryPage.jsx'))
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage.jsx'))
const CartPage = lazy(() => import('./pages/CartPage.jsx'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'))
const FaqPage = lazy(() => import('./pages/FaqPage.jsx'))
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const OrdersPage = lazy(() => import('./pages/OrdersPage.jsx'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage.jsx'))
const ProductsPage = lazy(() => import('./pages/ProductsPage.jsx'))
const SupportPage = lazy(() => import('./pages/SupportPage.jsx'))
const WishlistPage = lazy(() => import('./pages/WishlistPage.jsx'))

function RouteLoadingFallback() {
  return (
    <div className="page-grid">
      <section className="content-card">
        <p className="notice">Loading page...</p>
      </section>
    </div>
  )
}

function AuthBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth()

  useEffect(() => {
    let active = true

    async function syncToken() {
      if (!isLoaded) {
        return
      }

      if (!isSignedIn) {
        setApiAuthToken(null)
        setApiAuthTokenProvider(null)
        return
      }

      setApiAuthTokenProvider(async () => {
        if (!isSignedIn) {
          return null
        }

        return getToken({ skipCache: true })
      })

      const token = await getToken()

      if (active) {
        setApiAuthToken(token)
      }
    }

    syncToken().catch(() => {
      setApiAuthToken(null)
      setApiAuthTokenProvider(null)
    })

    return () => {
      active = false
    }
  }, [getToken, isLoaded, isSignedIn])

  return null
}

function SignInLanding() {
  return (
    <main className="auth-landing">
      <section className="auth-card">
        <p className="eyebrow">XETA</p>
        <h1>Sign in to continue</h1>
        <p>
          Use your Clerk account to access carts, checkout, orders, and admin tools.
        </p>
        <SignedOut>
          <SignInButton mode="modal" fallbackRedirectUrl="/post-auth">
            <button type="button" className="button button-primary">
              Open sign in
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </section>
    </main>
  )
}

function PostAuthRedirect() {
  const { isLoaded, isSignedIn } = useAuth()
  const { profile, loading } = useSession()

  if (!isLoaded || loading) {
    return (
      <div className="page-grid">
        <section className="content-card">
          <p className="kicker">Loading</p>
          <h1>Finishing sign in</h1>
          <p className="muted">Preparing your account destination.</p>
        </section>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  if (profile?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <Navigate to="/" replace />
}

function AdminShoppingRedirect({ children }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { profile, loading } = useSession()

  if (!isLoaded || loading) {
    return children
  }

  if (isSignedIn && profile?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return children
}

function App({ clerkReady }) {
  if (!clerkReady) {
    return <SetupPage />
  }

  return (
    <SessionProvider>
      <CartProvider>
        <WishlistProvider>
          <AuthBridge />
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route
                  index
                  element={
                    <AdminShoppingRedirect>
                      <HomePage />
                    </AdminShoppingRedirect>
                  }
                />
                <Route
                  path="products"
                  element={
                    <AdminShoppingRedirect>
                      <ProductsPage />
                    </AdminShoppingRedirect>
                  }
                />
                <Route
                  path="products/:slug"
                  element={
                    <AdminShoppingRedirect>
                      <ProductDetailPage />
                    </AdminShoppingRedirect>
                  }
                />
                <Route
                  path="wishlist"
                  element={
                    <ProtectedRoute disallowAdmin>
                      <WishlistPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="cart"
                  element={
                    <ProtectedRoute disallowAdmin>
                      <CartPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="checkout"
                  element={
                    <ProtectedRoute disallowAdmin>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <ProtectedRoute disallowAdmin>
                      <OrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="support"
                  element={
                    <ProtectedRoute disallowAdmin>
                      <SupportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="faq"
                  element={
                    <ProtectedRoute disallowAdmin>
                      <FaqPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="account"
                  element={
                    <ProtectedRoute>
                      <AccountPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminAnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/products"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminProductsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/reviews"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminReviewsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/support"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminSupportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/orders"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminOrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/customers"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminCustomersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/inventory"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminInventoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/analytics"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminAnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="sign-in" element={<SignInLanding />} />
                <Route path="post-auth" element={<PostAuthRedirect />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </WishlistProvider>
      </CartProvider>
    </SessionProvider>
  )
}

export default App
