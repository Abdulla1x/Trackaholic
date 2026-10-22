import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted, because the site's Content-Security-Policy allows fonts only
// from itself. Mona Sans with its width axis (75-125%), which the type scale
// leans on; Libre Franklin for the wordmark and the Label style.
import '@fontsource-variable/mona-sans/wdth.css'
import '@fontsource-variable/libre-franklin/wght.css'
import './index.css'
import App from './App.tsx'
import { AppearanceProvider } from './appearance/AppearanceContext'
import { AuthProvider } from './auth/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import { listenForInstall } from './lib/installEvent'
import { startServiceWorker } from './lib/swUpdate'

// Runs at module scope, before render, where no error boundary can reach it.
// Service worker registration is an enhancement — offline caching and the
// install prompt — and the app is fully usable without it, so a browser that
// refuses it must not take the page down on the way in. New versions wait for
// the user's go-ahead: see lib/swUpdate.ts.
try {
  startServiceWorker()
} catch (err) {
  console.error('Service worker registration failed:', err)
}

// Before render too: Chromium can offer the install prompt before anything
// mounts, and an event nobody was listening for is gone. See lib/installEvent.ts.
listenForInstall()

// Some mobile browsers (iOS Safari among them) only apply :active on a tap
// when the page has a touch listener, and :active is the pressed state every
// control relies on (UA-34). An empty passive listener costs nothing.
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside AuthProvider deliberately: the provider reads the stored token
        during its first render, which is exactly where the white-screen crash
        on a storage-blocked browser came from. A boundary inside it would
        never have caught that. */}
    <ErrorBoundary>
      {/* The router itself is created in App.tsx (a data router, for
          useBlocker). AuthProvider sits outside it: it uses no router hooks,
          and RequireAuth inside the tree does the redirecting. */}
      {/* Outside AuthProvider too: the theme belongs to the device, and the
          sign-in screens follow it as well. */}
      <AppearanceProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppearanceProvider>
    </ErrorBoundary>
  </StrictMode>,
)
