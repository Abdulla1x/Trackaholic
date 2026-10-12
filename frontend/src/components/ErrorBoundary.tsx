import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/ui/button'

/** The last thing between a thrown render error and a blank white page.
 *
 * React unmounts the whole tree when a render throws and nothing catches it,
 * which leaves the user looking at an empty document with no indication that
 * anything happened — not an error, not a reload prompt, nothing to report.
 *
 * This is the only class component in the codebase, and has to be: error
 * boundaries have no hook equivalent. React has not added one, so this is not a
 * style choice that will age out.
 *
 * Placed outside AuthProvider in main.tsx on purpose. The crash it was written
 * for happened *inside* AuthProvider, which reads the stored token during its
 * first render; a boundary nested under the provider would never have seen it.
 */
interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // There is no error-reporting service wired up, so the console is the whole
    // trail. Logging the component stack as well as the error is what makes it
    // usable in a screenshot from someone else's browser.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <CrashScreen error={this.state.error} />
  }
}

/** What a broken page shows instead of a white one.
 *
 * Shared by the boundary above and by the router's errorElement (App.tsx). A
 * data router catches errors thrown while rendering a route in a boundary of
 * its own, so they never reach ErrorBoundary; without an errorElement they
 * would land on React Router's built-in developer page instead of this one. */
export function CrashScreen({ error }: { error: unknown }) {
  const message = (error instanceof Error && error.message) || String(error)
  // bg-ground and text-ink: this can render outside everything else, so it
  // sets its own colours rather than trusting the page behind it.
  return (
    <div className="grid min-h-dvh place-items-center bg-ground p-6 text-ink">
      <section className="grid w-full max-w-md gap-3">
        <h1 className="text-[20px] leading-tight font-bold [font-stretch:105%]">Something broke on this page</h1>
        <p className="text-small">
          Not your data — that is safe on the server. This is the app failing
          to draw itself, and reloading usually clears it.
        </p>
        <p className="text-small">
          If it keeps happening, one known cause is a browser set to block
          site data. Allowing it for this site, or leaving private browsing,
          fixes that particular case.
        </p>
        <Button onClick={() => window.location.reload()} className="mt-2 w-full">
          Reload
        </Button>
        {/* The message itself, not a friendly paraphrase: it is the only
            thing that makes a bug report actionable, and hiding it helps
            nobody who is already looking at a broken page. */}
        <p className="mt-1 break-words text-small text-ink-2">{message}</p>
      </section>
    </div>
  )
}
