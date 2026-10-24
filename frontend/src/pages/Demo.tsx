import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import AuthFrame, { AUTH_LINK, AUTH_NOTE, AUTH_TITLE } from '../components/auth/AuthFrame'
import WakingNotice from '../components/WakingNotice'
import { useLiveMessage } from '../hooks/useLiveMessage'
import { useWarmup } from '../hooks/useWarmup'
import { Button } from '@/ui/button'

/** /demo: a temporary account with a month of made-up data, opened in one go.
 *
 *  A signed-in visitor goes straight to the app, whether the account is real or
 *  a demo still within its 24 hours, so a second visit never makes a second
 *  demo. Everyone else gets a new one. `attempt` keys the inner page, so Try
 *  again starts the warm-up and the request afresh. */
export default function Demo() {
  const { user, loading } = useAuth()
  const [attempt, setAttempt] = useState(0)

  if (user) return <Navigate to="/" replace />
  // A stored login is being checked; it decides between the two branches.
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-small text-ink-2">Loading…</p>
      </div>
    )
  }
  return <Opening key={attempt} onRetry={() => setAttempt((n) => n + 1)} />
}

// `retry`: worth trying again now. `story`: the demo is out for the day, so
// the story page's screenshots stand in for it.
type Failure = { title: string; text: string; retry: boolean; story?: boolean }

/** How long the server may take to answer before the wait is explained, the
 *  same 3 seconds after which WakingNotice draws its bar. On an awake server
 *  the demo is ready before then, so the visitor never reads about waking. */
const EXPLAIN_AFTER_MS = 3000

function Opening({ onRetry }: { onRetry: () => void }) {
  const { startDemo } = useAuth()
  // The health ping first, and the demo only once it answers: a sleeping
  // instance is often refused at the edge in about a second rather than held
  // while it boots (hooks/useWarmup.ts), so a POST sent straight away would
  // fail on most cold visits.
  const warmup = useWarmup()
  const [startedAt] = useState(Date.now)
  const [slow, setSlow] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  useLiveMessage(failure?.text)
  // StrictMode runs effects twice in development; one visit makes one demo.
  const sent = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), EXPLAIN_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (warmup !== 'ready' || sent.current) return
    sent.current = true
    // Success needs nothing here: the signed-in user re-renders Demo, which
    // sends them on to Today.
    startDemo().catch((err: unknown) => setFailure(describe(err)))
  }, [warmup, startDemo])

  if (warmup === 'unavailable') {
    return (
      <Failed
        failure={{
          title: 'Can’t reach the server',
          text: 'The server isn’t answering. It may be slow to wake or briefly down. Try again in a few minutes.',
          retry: true,
        }}
        onRetry={onRetry}
      />
    )
  }
  if (failure) return <Failed failure={failure} onRetry={onRetry} />

  return (
    <AuthFrame warmup={false}>
      <h1 className={AUTH_TITLE}>Opening the demo</h1>
      {warmup === 'waking' && slow ? (
        <WakingNotice startedAt={startedAt} className="text-center text-small text-ink-2">
          {' '}Your demo is made as soon as it answers.
        </WakingNotice>
      ) : (
        <p className="text-center text-small text-ink-2">
          <span aria-hidden="true" className="animate-pulse text-action motion-reduce:animate-none">
            ●
          </span>{' '}
          Making your demo: a month of made-up meals, weigh-ins, water and steps.
        </p>
      )}
      <p className="text-center text-small text-ink-2">
        <Link to="/login" className={AUTH_LINK}>
          Back to log in
        </Link>
      </p>
    </AuthFrame>
  )
}

function describe(err: unknown): Failure {
  if (err instanceof ApiError && err.status === 503) {
    return {
      title: 'The demo is busy today',
      text: 'Lots of people tried it today, and it has a daily limit. It opens again tomorrow.',
      retry: false,
      story: true,
    }
  }
  if (err instanceof ApiError && err.status === 429) {
    return {
      title: 'That’s a lot of demos',
      text: 'Several demos were started from this connection in the last hour. Try again later.',
      retry: false,
    }
  }
  return {
    title: 'The demo didn’t open',
    text: err instanceof Error && err.message ? err.message : 'Check your connection, then try again.',
    retry: true,
  }
}

function Failed({ failure, onRetry }: { failure: Failure; onRetry: () => void }) {
  return (
    <AuthFrame warmup={false}>
      <h1 className={AUTH_TITLE}>{failure.title}</h1>
      <p className={AUTH_NOTE}>{failure.text}</p>
      {failure.retry && (
        <Button onClick={onRetry} className="w-full">
          Try again
        </Button>
      )}
      <Button asChild variant={failure.retry ? 'secondary' : 'primary'} className="w-full">
        <Link to="/signup">Create an account</Link>
      </Button>
      {failure.story && (
        <Button asChild variant="secondary" className="w-full">
          <a href="https://story.trackaholic.app" target="_blank" rel="noopener noreferrer">
            See how the app looks
          </a>
        </Button>
      )}
      <p className="text-center text-small text-ink-2">
        Have an account?{' '}
        <Link to="/login" className={AUTH_LINK}>
          Log in
        </Link>
      </p>
    </AuthFrame>
  )
}
