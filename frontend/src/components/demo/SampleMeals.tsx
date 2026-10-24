import { useEffect, useId, useState } from 'react'
import { api } from '../../api/client'
import { useAnalysis } from '../../analysis/AnalysisContext'
import type { LibraryContext } from '../../lib/libraryMatch'
import type { DemoSample, MealAnalysisResponse } from '../../types'
import EstimateResult from '../log/EstimateResult'
import EstimateStages from '../log/EstimateStages'
import { Button } from '@/ui/button'
import Retry from '@/ui/retry'

const LINK =
  'font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

/** The AI box for a demo account, which never calls the model: a sideways
 *  strip of Nutrition5k plates, each with the estimate the model really gave
 *  it, replayed by the server (chosen on a prototype, 2026-10-24: the strip,
 *  one tap to estimate, the lab value under the result).
 *
 *  A plain scrolling row of buttons, so the phone itself tells a swipe from a
 *  tap: a finger that moves scrolls and presses nothing. A stray tap costs one
 *  "Pick another"; nothing is saved and no AI quota is spent. */
export default function SampleMeals({
  mode,
  onApply,
}: {
  mode: 'save' | 'apply'
  onApply: (analysis: MealAnalysisResponse, foods: LibraryContext) => void
}) {
  const { analysis, analyzing, error, progress, sample, analyzeSample, reset, attached, library } = useAnalysis()
  const headingId = useId()
  const [samples, setSamples] = useState<DemoSample[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    api.demoSamples().then(
      (list) => !cancelled && setSamples(list),
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  // A plate is in play from the tap until the estimate is saved or put back.
  const chosen = sample !== null && (analyzing || analysis !== null) ? sample : null

  return (
    <section aria-labelledby={headingId} className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <h3 id={headingId} className="text-field-label text-ink-2">
        Estimate a sample meal
      </h3>

      {chosen ? (
        <div className="flex items-center gap-3">
          <img src={chosen.photo} alt="" className="size-[72px] shrink-0 rounded-tag object-cover" />
          <p className="min-w-0 flex-1 text-small">{chosen.note}</p>
          {!analyzing && (
            <Button variant="ghost" onClick={reset} className="shrink-0">
              Pick another
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-small">
            The demo doesn&rsquo;t run the AI. Pick a plate to see an estimate it really made earlier, from the photo
            and the weighed list.
          </p>
          {samples ? (
            <>
              {/* Bleeds to the panel's edges, so the next card shows half cut
                  off: the cue that the row scrolls. */}
              <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1.5 desk:-mx-7 desk:scroll-px-7 desk:px-7">
                {samples.map((plate) => (
                  <li key={plate.id} className="w-[148px] shrink-0 snap-start">
                    <button
                      type="button"
                      data-sample={plate.id}
                      onClick={() => void analyzeSample(plate)}
                      className="grid h-full w-full grid-rows-[auto_1fr] overflow-hidden rounded-control border-[1.5px] border-rule text-left [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action active:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]"
                    >
                      <img src={plate.photo} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                      <span className="grid content-start gap-1 px-2.5 pt-2 pb-2.5">
                        <span className="line-clamp-2 text-[13.5px] leading-snug font-semibold">{plate.meal_name}</span>
                        <span className="line-clamp-2 text-xs leading-snug text-ink-2">{plate.note}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-small text-ink-2">{samples.length} plates · scroll sideways for more</p>
            </>
          ) : failed ? (
            <Retry text="The sample meals didn't load." onRetry={() => setAttempt((n) => n + 1)} />
          ) : (
            <p className="text-small text-ink-2">Loading the sample meals…</p>
          )}
        </>
      )}

      <EstimateStages state={progress} photos={0} hasNote={false} savedFoods={0} replay />
      {/* Ink and words, never red (DESIGN.md, the No Red Rule). */}
      {error && <p className="border-l-2 border-ink pl-3 text-small">{error}</p>}

      <p className="text-small text-ink-2">
        Plates, photos and lab weights from{' '}
        <a href="https://github.com/google-research-datasets/Nutrition5k" target="_blank" rel="noopener noreferrer" className={LINK}>
          Nutrition5k
        </a>{' '}
        (Google Research), CC BY 4.0.
      </p>

      {analysis && (
        <EstimateResult analysis={analysis} mode={mode} onApply={() => onApply(analysis, { attached, library })} />
      )}
    </section>
  )
}
