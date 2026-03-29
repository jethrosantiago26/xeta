import { SignInButton, useAuth } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'

function ProtectedRoute({ children, requireAdmin = false, disallowAdmin = false }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { profile, loading } = useSession()

  if (!isLoaded || loading) {
    return (
      <div className="page-grid">
        <section className="content-card">
          <p className="kicker">Loading</p>
          <h1>Preparing your session</h1>
          <p className="muted">Syncing your Clerk session with the Laravel API.</p>
        </section>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="page-grid">
        <section className="content-card">
          <p className="kicker">Protected</p>
          <h1>Sign in required</h1>
          <p className="muted">This page is only available to authenticated users.</p>
          <SignInButton mode="modal" fallbackRedirectUrl="/post-auth">
            <button type="button" className="button button-primary">
              Sign in
            </button>
          </SignInButton>
        </section>
      </div>
    )
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  if (disallowAdmin && profile?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return children
}

export default ProtectedRoute