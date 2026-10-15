import { useEffect, useState } from 'react'
import { api } from '../api/client'
import ScreenBar from '../components/shell/ScreenBar'
import { accuracyProgress, CALIBRATION_MIN_CORRECTIONS } from '../lib/accuracy'
import { useLiveMessage } from '../hooks/useLiveMessage'
import type { Calibration, MacroCalibration } from '../types'
import Block from '@/ui/block'
import Explainer from '@/ui/explainer'
import Gauge from '@/ui/gauge'
import Retry from '@/ui/retry'
import { Stat, StatGrid } from '@/ui/stat'

const round = (value: number) => Math.round(value)

/** How close the AI's estimates were, in Progress (0a). Measured against what
 *  was saved, which is the user's best information rather than a lab result,
 *  so it is how far the estimates were moved, not how wrong they were.
 *
 *  Below ten corrected estimates it refuses to give a figure, and shows how
 *  close it is instead: a rate from a handful of corrections would be the same
 *  false precision this screen exists to expose. */
export default function AiAccuracy() {
  const [data, setData] = useState<Calibration | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useLiveMessage(failed ? "Couldn't load the AI's accuracy." : null)

  useEffect(() => {
    let live = true
    setFailed(false)
    api.getCalibration().then(
      (next) => live && setData(next),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [attempt])

  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="AI accuracy" back="/progress" backLabel="Back to Progress" />

      {failed ? (
        <Retry
          text="Couldn't load the AI's accuracy. Check your connection, then try again."
          onRetry={() => setAttempt((now) => now + 1)}
          role="alert"
          className="mt-3"
        />
      ) : !data ? (
        <p role="status" className="py-6 text-center text-small text-ink-2">
          Checking…
        </p>
      ) : (
        <Body data={data} />
      )}
    </div>
  )
}

function Body({ data }: { data: Calibration }) {
  const progress = accuracyProgress(data)

  return (
    <>
      <p className="py-3 text-small text-ink-2">
        How often what you saved landed inside the range the AI gave, counted from the estimates you corrected.
      </p>

      {progress.locked ? (
        <Block label="Corrected estimates" value={`${progress.have} of ${CALIBRATION_MIN_CORRECTIONS}`}>
          <Gauge segments={10} lit={Math.min(10, progress.have)} className="h-2.5" />
          <p className="text-small">{progress.reason}</p>
        </Block>
      ) : (
        <Block label="Landed in range">
          <StatGrid>
            <MacroStat label="Calories" macro={data.calories} />
            <MacroStat label="Protein" macro={data.protein} />
          </StatGrid>
          {data.by_confidence.length > 0 && (
            <p className="text-small text-ink-2">
              Calories by the confidence shown:{' '}
              {data.by_confidence
                .map(
                  (bucket) =>
                    `${bucket.confidence} ${round(bucket.coverage_pct ?? 0)}% (${bucket.covered} of ${bucket.corrected})`,
                )
                .join(' · ')}
            </p>
          )}
        </Block>
      )}

      {data.linked > 0 && (
        <Block label="Meals saved from an estimate" value={data.linked.toLocaleString()}>
          <StatGrid>
            <Stat label="Saved unchanged">{data.accepted_unchanged.toLocaleString()}</Stat>
            <Stat label="You corrected">{data.corrected.toLocaleString()}</Stat>
          </StatGrid>
          {/* The load-bearing caveat, kept on screen rather than behind the
              disclosure: a high unchanged count is equally consistent with
              trusting the number and with never checking it. */}
          <p className="text-small text-ink-2">
            Saving an estimate unchanged says nothing about whether it was right: the saved value is the estimate.
            Only corrected meals can measure the range.
          </p>
          <Explainer>
            <p>
              Counted only from meals saved straight after an estimate; later edits aren't included. Using a saved
              food's numbers counts as a correction, so some figures measure your library rather than you.
            </p>
            <p className="mt-1.5">
              Weighed portions and voice notes narrow the range, so this describes the app the way you log.{' '}
              {data.analyses.toLocaleString()} estimates run in all.
            </p>
          </Explainer>
        </Block>
      )}
    </>
  )
}

/** One macro's rate with its plausible band, or the reason there isn't one:
 *  per macro, because protein and calories fill up at different speeds. */
function MacroStat({ label, macro }: { label: string; macro: MacroCalibration }) {
  if (macro.coverage_pct === null) {
    return (
      <div className="grid content-start gap-1.5 py-2.5">
        <span className="text-field-label text-ink-2">{label}</span>
        <span className="text-field-number leading-none text-ink-2">—</span>
        <span className="text-small text-ink-2">{macro.unavailable_reason}</span>
      </div>
    )
  }
  return (
    <div className="grid content-start gap-1.5 py-2.5">
      <span className="text-field-label text-ink-2">{label}</span>
      <span className="text-field-number leading-none tabular-nums">{round(macro.coverage_pct)}%</span>
      {/* The band, not just the point: a rate from a small sample is itself an
          estimate. */}
      {macro.coverage_low_pct !== null && macro.coverage_high_pct !== null && (
        <span className="text-small text-ink-2">
          plausibly {round(macro.coverage_low_pct)} to {round(macro.coverage_high_pct)}%, from {macro.corrected}{' '}
          corrections
        </span>
      )}
      {macro.median_signed_error_pct !== null && (
        <span className="text-small text-ink-2">
          typically moved {macro.median_signed_error_pct >= 0 ? 'up' : 'down'}{' '}
          {round(Math.abs(macro.median_signed_error_pct))}%
        </span>
      )}
    </div>
  )
}
