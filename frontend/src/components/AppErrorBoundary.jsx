import { Component } from 'react'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown runtime error',
    }
  }

  componentDidCatch(error, info) {
    // Keep the stack available in browser devtools for debugging.
    console.error('App render crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-landing">
          <section className="auth-card">
            <p className="eyebrow" style={{ textAlign: 'center' }}>Runtime Error</p>
            <h1>XETA failed to render</h1>
            <p style={{ marginBottom: '16px' }}>
              A frontend error occurred while loading this page.
            </p>
            <div className="notice error" style={{ textAlign: 'left' }}>
              {this.state.errorMessage}
            </div>
            <p className="muted" style={{ marginTop: '12px' }}>
              Open browser developer tools and check the Console for the full stack trace.
            </p>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

export default AppErrorBoundary
