import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { addDays, localIsoDate, parseIsoDate } from '../lib/dates'
import type { ReviewCheck, WeeklyReview } from '../types'
import Card from '../components/ui/Card'
import { primaryButtonClass } from '../components/ui/Button'
import { useLiveMessage } from '../hooks/useLiveMessage'
import { checkFigure, checkLabel, checkStatus } from '../lib/review'

/** The colour beside each check's word. Only "on track" gets one, so the page
 *  is calm by default (no amber, which means an incident in this app). */
const STATUS_CLASS: Record<ReviewCheck['status'], string> = {
  on_track: 'text-emerald-300',
  off_track: 'text-ink-muted',
  unknown: 'text-ink-faint',
  note: '',
}

function CheckCard({ check }: { check: ReviewCheck }) {
  const status = checkStatus(check)
  const value = checkFigure(check)

  return (
    <Card as="section">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-semibold">{checkLabel(check)}</h2>
        {status && <span className={`text-xs ${STATUS_CLASS[check.status]}`}>{status}</span>}
      </div>

      {value && <p className="mt-2 text-2xl font-bold">{value}</p>}

      <p className="mt-2 text-sm text-ink-muted">
        {check.detail || check.unavailable_reason}
      </p>
    </Card>
  )
}

const longDate = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export default function Review() {
  const [data, setData] = useState<WeeklyReview | null>(null)
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarising, setSummarising] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  useLiveMessage(summaryError)

  async function putIntoWords() {
    setSummarising(true)
    setSummaryError(null)
    try {
      // The same window the numbers above were fetched for, or the words would
      // describe a different week from the figures they sit under.
      const result = await api.phraseReview(addDays(localIsoDate(), -1))
      setSummary(result.summary)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Could not write a summary.')
    } finally {
      setSummarising(false)
    }
  }

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    // Yesterday by the BROWSER's clock, not the server's. No timezone is stored
    // for anyone and the server's today is UTC, so letting it choose would give
    // the wrong week to everyone hours off UTC. Dashboard's seven-day trend
    // passes its own dates for exactly this reason.
    api
      .getReview(addDays(localIsoDate(), -1))
      .then((result) => {
        if (!stale) setData(result)
      })
      .catch((err) => {
        if (stale) return
        setData(null)
        setError(err instanceof Error ? err.message : 'Could not load your review.')
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [attempt])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Weekly review</h1>
        <p className="text-sm text-ink-muted">
          {data
            ? `The seven days from ${longDate(data.window_start)} to ${longDate(data.window_end)}.`
            : 'Your last seven complete days.'}
        </p>
      </header>

      {/* Said once, at the top, rather than as a caveat under every figure.
          The window stopping at yesterday is the single thing most likely to
          make someone think the page is wrong when it is right. */}
      <p className="text-xs text-ink-faint">
        Today is left out on purpose — it is only half logged, and averaging a
        day that still has dinner to come would make every week look better than
        it was. Each section says what it was worked out from; they are not all
        the same seven days.
      </p>

      {loading ? (
        <Card as="p" pad="lg" className="text-center text-sm text-ink-faint">
          Working it out…
        </Card>
      ) : error ? (
        <Card as="section" tone="danger" pad="lg" className="text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 rounded-control border border-slate-700 px-3 py-1 text-xs hover:border-emerald-500 hover:text-emerald-300"
          >
            Retry
          </button>
        </Card>
      ) : (
        data && (
          <>
            {data.checks.map((check) => (
              <CheckCard key={check.key} check={check} />
            ))}
            <Card as="section">
              <h2 className="font-semibold">Put this into words</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Ask the AI to read the sections above back as a couple of
                paragraphs. It is given these figures and nothing else, and it
                is not allowed to work anything out, add a number, or tell you
                what to do — every one of those stays here, where it can be
                checked.
              </p>

              {summary ? (
                <Card tone="sunken" className="mt-3">
                  {/* Paragraph by paragraph rather than one block, so the
                      model's own breaks survive. Plain text, never markup. */}
                  {summary.split(/\n{2,}/).map((paragraph, index) => (
                    <p key={index} className={index === 0 ? 'text-sm' : 'mt-3 text-sm'}>
                      {paragraph}
                    </p>
                  ))}
                  <p className="mt-3 text-xs text-ink-faint">
                    Written by the AI from the figures above. The numbers are
                    the ones on this page; the wording is not.
                  </p>
                </Card>
              ) : (
                <button
                  onClick={putIntoWords}
                  disabled={summarising}
                  className={`${primaryButtonClass} mt-3 px-4 py-2 disabled:opacity-60`}
                >
                  {summarising ? 'Writing…' : 'Put this into words'}
                </button>
              )}

              {summaryError && (
                <p className="mt-3 text-sm text-rose-400">{summaryError}</p>
              )}

              {!summary && (
                <p className="mt-2 text-xs text-ink-faint">
                  Uses one of a small daily allowance, separate from your meal
                  estimates. It is not saved — reopening this page shows the
                  figures again, not the wording.
                </p>
              )}
            </Card>

            <p className="text-xs text-ink-faint">
              Every number on this page is worked out from what you logged, and
              none of them comes from the AI.{' '}
              <Link to="/analytics" className="underline hover:text-emerald-300">
                Analytics
              </Link>{' '}
              has the day-by-day figures behind them.
            </p>
          </>
        )
      )}
    </div>
  )
}
