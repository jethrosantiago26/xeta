import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppErrorBoundary>
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <BrowserRouter>
              <App clerkReady />
            </BrowserRouter>
          </ClerkProvider>
        ) : (
          <BrowserRouter>
            <App clerkReady={false} />
          </BrowserRouter>
        )}
      </AppErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
