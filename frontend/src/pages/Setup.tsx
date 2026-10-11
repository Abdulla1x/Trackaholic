import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import ScreenBar from '../components/shell/ScreenBar'
import { useLiveMessage } from '../hooks/useLiveMessage'
import { ACTIVITY_HINT, ACTIVITY_OPTIONS, ACTIVITY_QUESTION } from '../lib/activity'
import { localIsoDate } from '../lib/dates'
import {
  answered,
  autoSettings,
  birthProblem,
  emptyAnswers,
  fastestReason,
  goalWeightRemark,
  heightProblem,
  lossRefused,
  PACE_CHIPS,
  paceKg,
  paceProblem,
  paceText,
  previewRequest,
  QUESTIONS,
  regionUnit,
  screenFrom,
  weightKg,
  weightProblem,
  type Answers,
  type Question,
  type SetupScreen,
} from '../lib/setup'
import { readLocal, writeLocal } from '../lib/storage'
import { CHANGE_TRACKERS, TRACKERS, withTracker } from '../lib/trackers'
import { KG_PER_LB } from '../lib/units'
import { useSettings } from '../settings/SettingsContext'
import type { BodyTargets } from '../types'
import { Button } from '@/ui/button'
import { Chip } from '@/ui/chip'
import { FIELD } from '@/ui/field'
import { NextIcon } from '@/ui/icons'
import { useToast } from '@/ui/toast'
import { cn } from '@/lib/utils'

const TITLES: Record<Question, string> = {
  weight: 'Your weight today',
  height: 'Your height',
  birth: 'Your date of birth',
  sex: 'Sex',
  activity: 'How active are you?',
  goal: 'Your goal',
  extras: 'A few extras',
}

/** The answers so far, per account, so a reload or a closed tab picks up
 *  where it left off and a second account on the same phone starts fresh.
 *  Cleared once the target is saved. */
const draftKey = (userId: number) => `trackaholic_setup_draft:${userId}`

function readDraft(userId: number): Answers | null {
  const raw = readLocal(draftKey(userId))
  if (!raw) return null
  try {
    return { ...emptyAnswers('kg'), ...(JSON.parse(raw) as Partial<Answers>) }
  } catch {
    return null
  }
}

/** A short field with its unit beside it, in the condensed number face. */
function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  placeholder,
  inputMode = 'decimal',
}: {
  id: string
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
}) {
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="text-small text-ink-2">{label}</span>
      <span className="flex items-center gap-2">
        <input
          id={id}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(FIELD, 'w-[120px] text-field-number')}
        />
        <span className="text-ink-2">{unit}</span>
      </span>
    </label>
  )
}

function Problem({ text, warn = false }: { text: string | null; warn?: boolean }) {
  if (!text) return null
  return (
    <p role={warn ? 'status' : 'alert'} className={cn('border-l-2 pl-3 text-small', warn ? 'border-rule text-ink-2' : 'border-ink')}>
      {text}
    </p>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink-2">{children}</p>
}

/** Six segments lighting in turn where a spinner would be (DESIGN.md Motion:
 *  Server waking). */
function WakeSegments() {
  return (
    <span aria-hidden="true" className="flex h-3 gap-0.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-1.5 bg-ink opacity-20 animate-wake-segment"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </span>
  )
}

/** Set your target (/setup): first use's one form, one question per screen
 *  (decided from the first-use prototype, 2026-10-11).
 *
 *  - The step is in the address (?q=height), so the phone's back gesture
 *    steps back a question, and answers are kept on reload.
 *  - The live target comes from POST /settings/targets/preview, the same
 *    calculation the save makes, so the number shown is the number kept.
 *  - Saving writes the weigh-in first, then turns automatic targets on; the
 *    server writes the goals from the profile in that same request. Nothing
 *    invented is shown in between, and a failure in the second step keeps
 *    the first. */
export default function Setup() {
  const { user } = useAuth()
  const { settings, updateSettings } = useSettings()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const screen = screenFrom(params.get('q'))
  const today = localIsoDate()
  const userId = user?.id ?? 0

  const [a, setA] = useState<Answers>(() => readDraft(userId) ?? emptyAnswers(regionUnit(navigator.language)))
  const patch = (next: Partial<Answers>) => setA((now) => ({ ...now, ...next }))
  useEffect(() => {
    writeLocal(draftKey(userId), JSON.stringify(a))
  }, [a, userId])

  // A weigh-in already saved today fills the first question.
  useEffect(() => {
    if (a.weight !== '') return
    let live = true
    api
      .getWeights(today, today)
      .then((entries) => {
        const kg = entries[0]?.weight_kg
        if (!live || kg === undefined) return
        setA((now) => (now.weight !== '' ? now : { ...now, weight: String(now.unit === 'lb' ? Math.round((kg / KG_PER_LB) * 10) / 10 : kg) }))
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- the preview -----
  const [preview, setPreview] = useState<BodyTargets | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [waking, setWaking] = useState(false)
  const [retry, setRetry] = useState(0)
  const maxKg = preview ? (a.goal === 'lose' ? (preview.max_loss_kg_per_week ?? null) : (preview.max_gain_kg_per_week ?? null)) : null
  const request = previewRequest(a, maxKg)
  const requestKey = request ? JSON.stringify(request) : ''
  const wantsPreview = screen === 'goal' || screen === 'extras' || screen === 'target'
  useEffect(() => {
    if (!wantsPreview || !request) return
    let live = true
    const started = window.setTimeout(() => {
      setPreviewFailed(false)
      const slow = window.setTimeout(() => live && setWaking(true), 1500)
      api
        .previewTargets(request)
        .then((next) => live && setPreview(next))
        .catch(() => live && setPreviewFailed(true))
        .finally(() => {
          window.clearTimeout(slow)
          if (live) setWaking(false)
        })
    }, 300)
    return () => {
      live = false
      window.clearTimeout(started)
    }
    // requestKey stands for the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, wantsPreview, retry])

  // ----- moving between questions -----
  const index = (s: SetupScreen) => (s === 'start' ? -1 : s === 'target' ? QUESTIONS.length : QUESTIONS.indexOf(s as Question))
  const go = (next: SetupScreen) => navigate({ search: next === 'start' ? '' : `?q=${next}` })
  const back = () => {
    // Steps back through the history this form made; arriving by a reload or
    // a link, there is none, so the previous question replaces this one.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else {
      const i = index(screen)
      navigate({ search: i <= 0 ? '' : `?q=${QUESTIONS[i - 1]}` }, { replace: true })
    }
  }
  const nextOf = (s: Question): SetupScreen => {
    return QUESTIONS[QUESTIONS.indexOf(s) + 1] ?? 'target'
  }

  // The new screen slides in from the side it came from, and focus moves to
  // its heading, which is announced with how far along it is.
  const shown = useRef(screen)
  const direction = index(screen) >= index(shown.current) ? 'push' : 'back'
  useEffect(() => {
    shown.current = screen
  }, [screen])
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [screen])
  const qNumber = QUESTIONS.indexOf(screen as Question) + 1
  useLiveMessage(qNumber > 0 ? `Question ${qNumber} of ${QUESTIONS.length}: ${TITLES[screen as Question]}` : null)

  // ----- saving -----
  const [saving, setSaving] = useState(false)
  const [weighInSaved, setWeighInSaved] = useState(false)
  const [saveProblem, setSaveProblem] = useState<string | null>(null)
  const useTarget = async () => {
    if (!settings || !preview) return
    const w = weightKg(a)
    const rate = paceKg(a, maxKg)
    if (w === null || rate === null) return
    setSaving(true)
    setSaveProblem(null)
    try {
      if (!weighInSaved) {
        await api.saveWeight({ date: today, weight_kg: Math.round(w * 1000) / 1000 })
        setWeighInSaved(true)
      }
    } catch {
      setSaving(false)
      setSaveProblem("That didn't save. Check your connection, then try again.")
      return
    }
    try {
      const saved = await updateSettings(autoSettings(settings, a, rate))
      writeLocal(draftKey(userId), '')
      toast.show({
        text: `Your target: ${Math.round(saved.calorie_goal).toLocaleString()} kcal and ${Math.round(saved.protein_goal)} g protein. A guide, not a rule.`,
      })
      navigate('/', { state: { firstTarget: true } })
    } catch {
      setSaving(false)
      setSaveProblem("Your weigh-in is saved, but your target didn't save. Check your connection, then try again.")
    }
  }

  if (!settings) return null

  const max = preview
    ? {
        loss: preview.max_loss_kg_per_week ?? 0,
        gain: preview.max_gain_kg_per_week ?? 0,
        floorKcal: preview.floor_kcal ?? 0,
      }
    : null
  const w = weightKg(a)

  // ----- the screens -----
  let body: ReactNode
  let title = 'Set your target'
  let next: ReactNode = null

  if (screen === 'start') {
    body = (
      <>
        <p className="text-small text-ink-2">Only you see these answers. They’re used to work out your target, nothing else.</p>
        <div className="divide-y divide-rule border-y border-rule">
          <MethodRow
            label="Work it out for me"
            detail="A few questions about you; the target follows your weight as it changes"
            onClick={() => go('weight')}
          />
          <MethodRow label="I have my own numbers" detail="From a coach or another app; type them in" onClick={() => go('own')} />
        </div>
      </>
    )
    title = 'How do you want to set your target?'
  } else if (screen === 'own') {
    body = <p className="text-small text-ink-2">Typing your own numbers comes next.</p>
    title = 'Your own numbers'
  } else if (screen === 'target') {
    title = 'Your target'
    body = <TargetSummary a={a} preview={preview} failed={previewFailed} waking={waking} onRetry={() => setRetry((n) => n + 1)} max={max} />
    next = (
      <>
        <Problem text={saveProblem} />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={back}>
            Back
          </Button>
          <Button className="flex-1" disabled={!preview || waking || saving || previewFailed} onClick={useTarget}>
            {saveProblem ? 'Try again' : saving ? 'Saving…' : 'Use this target'}
          </Button>
        </div>
      </>
    )
  } else {
    const q = screen as Question
    title = TITLES[q]
    const ok = answered(q, a, today, maxKg)
    body = <QuestionBody q={q} a={a} patch={patch} today={today} preview={preview} max={max} weightKgNow={w} />
    next = (
      <div className="flex gap-2">
        <Button variant="ghost" onClick={back}>
          Back
        </Button>
        {q === 'extras' && (
          <Button
            variant="ghost"
            onClick={() => {
              patch({ goalWeight: '', carbsAndFat: false, trackers: [], remind: false })
              go('target')
            }}
          >
            Skip
          </Button>
        )}
        <Button className="flex-1" disabled={!ok} onClick={() => go(nextOf(q))}>
          Next
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="Set your target" back="/" backLabel="Back to Today" />
      {qNumber > 0 && (
        <div className="grid gap-2 border-b border-rule py-3.5">
          <span className="text-field-label text-ink-2">
            {qNumber} of {QUESTIONS.length}
          </span>
          <span aria-hidden="true" className="grid h-1.5 gap-0.5" style={{ gridTemplateColumns: `repeat(${QUESTIONS.length}, 1fr)` }}>
            {QUESTIONS.map((q, i) => (
              <span key={q} className={i < qNumber ? 'bg-ink' : 'bg-track'} />
            ))}
          </span>
        </div>
      )}
      <section
        key={screen}
        aria-labelledby="setup-question"
        className={cn('grid gap-4 py-4', direction === 'push' ? 'animate-screen-push' : 'animate-screen-back')}
      >
        <h2 id="setup-question" ref={heading} tabIndex={-1} className="text-title focus:outline-none">
          {title}
        </h2>
        {body}
        {next}
      </section>
    </div>
  )
}

function MethodRow({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-semibold">{label}</span>
        <span className="text-small text-ink-2">{detail}</span>
      </span>
      <NextIcon size={18} aria-hidden="true" className="shrink-0 text-ink-2" />
    </button>
  )
}

function QuestionBody({
  q,
  a,
  patch,
  today,
  preview,
  max,
  weightKgNow,
}: {
  q: Question
  a: Answers
  patch: (next: Partial<Answers>) => void
  today: string
  preview: BodyTargets | null
  max: { loss: number; gain: number; floorKcal: number } | null
  weightKgNow: number | null
}) {
  switch (q) {
    case 'weight':
      return (
        <>
          <div role="group" aria-label="Units" className="flex gap-1.5">
            {(['kg', 'lb'] as const).map((unit) => (
              <Chip
                key={unit}
                pressed={a.unit === unit}
                onClick={() =>
                  a.unit !== unit &&
                  // Switching units clears what was typed in the other one,
                  // rather than guessing which unit it was typed in.
                  patch({ unit, weight: '', heightCm: '', feet: '', inches: '', goalWeight: '', ownPace: '', pace: a.pace === 'max' ? 'max' : null })
                }
              >
                {unit === 'kg' ? 'kg · cm' : 'lb · ft'}
              </Chip>
            ))}
          </div>
          <NumberField id="setup-weight" label="Weight today" unit={a.unit} value={a.weight} onChange={(weight) => patch({ weight })} placeholder={a.unit === 'lb' ? 'e.g. 177' : 'e.g. 80.4'} />
          <Hint>It counts as your first weigh-in.</Hint>
          <Problem text={weightProblem(a)} />
        </>
      )
    case 'height':
      return (
        <>
          {a.unit === 'lb' ? (
            <div className="flex flex-wrap gap-3">
              <NumberField id="setup-feet" label="Feet" unit="ft" value={a.feet} onChange={(feet) => patch({ feet })} placeholder="5" inputMode="numeric" />
              <NumberField id="setup-inches" label="Inches" unit="in" value={a.inches} onChange={(inches) => patch({ inches })} placeholder="10" inputMode="numeric" />
            </div>
          ) : (
            <NumberField id="setup-height" label="Height" unit="cm" value={a.heightCm} onChange={(heightCm) => patch({ heightCm })} placeholder="e.g. 178" />
          )}
          <Problem text={heightProblem(a)} />
        </>
      )
    case 'birth':
      return (
        <>
          <label htmlFor="setup-birth" className="grid gap-1.5">
            <span className="text-small text-ink-2">Date of birth</span>
            <input
              id="setup-birth"
              type="date"
              max={today}
              value={a.birthDate}
              onChange={(event) => patch({ birthDate: event.target.value })}
              className={cn(FIELD, 'w-[200px]')}
            />
          </label>
          <Hint>Stored as the date, so your age stays right without you editing it.</Hint>
          <Problem text={birthProblem(a, today)} />
        </>
      )
    case 'sex':
      return (
        <>
          <div role="group" aria-label="Sex" className="flex gap-1.5">
            {(['female', 'male'] as const).map((sex) => (
              <Chip key={sex} pressed={a.sex === sex} onClick={() => patch({ sex })} className="flex-1 justify-center">
                {sex === 'female' ? 'Female' : 'Male'}
              </Chip>
            ))}
          </div>
          <Hint>The formula takes one of the two. If neither fits, pick either: after about two weeks the app measures your real burn.</Hint>
          <Hint>
            <b className="text-ink">Pregnant or breastfeeding?</b> These targets aren’t built for that. Your midwife or doctor can
            set one; you can still log meals.
          </Hint>
        </>
      )
    case 'activity':
      return (
        <>
          <p className="text-small text-ink-2">{ACTIVITY_QUESTION}</p>
          <div role="radiogroup" aria-label="Activity" className="divide-y divide-rule border-y border-rule">
            {ACTIVITY_OPTIONS.map((option) => {
              const on = a.activity === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => patch({ activity: option.value })}
                  className="flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                >
                  <span
                    aria-hidden="true"
                    className={cn('grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-ink', on && 'bg-ink')}
                  >
                    {on && <span className="size-2 rounded-full bg-ground" />}
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-semibold">{option.name}</span>
                    <span className="text-small text-ink-2">{option.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <Hint>{ACTIVITY_HINT} Pick the closest; after about two weeks the app measures your real burn and stops relying on this.</Hint>
        </>
      )
    case 'goal':
      return <GoalQuestion a={a} patch={patch} preview={preview} max={max} weightKgNow={weightKgNow} />
    case 'extras':
      return <ExtrasQuestion a={a} patch={patch} />
  }
}

function GoalQuestion({
  a,
  patch,
  preview,
  max,
  weightKgNow,
}: {
  a: Answers
  patch: (next: Partial<Answers>) => void
  preview: BodyTargets | null
  max: { loss: number; gain: number; floorKcal: number } | null
  weightKgNow: number | null
}) {
  const refused = lossRefused(a)
  const fastest = max ? (a.goal === 'lose' ? max.loss : max.gain) : null
  const chipKg = (value: string) => Number(value) * (a.unit === 'lb' ? KG_PER_LB : 1)
  return (
    <>
      <div role="group" aria-label="Goal" className="flex flex-wrap gap-1.5">
        {(
          [
            ['lose', 'Lose weight'],
            ['maintain', 'Maintain'],
            ['gain', 'Gain weight'],
          ] as const
        ).map(([goal, label]) => (
          <Chip
            key={goal}
            pressed={a.goal === goal && !(goal === 'lose' && refused)}
            disabled={goal === 'lose' && refused}
            onClick={() => patch({ goal, pace: a.pace === 'max' || a.pace === 'own' ? a.pace : null })}
            className="flex-1 justify-center disabled:opacity-45"
          >
            {label}
          </Chip>
        ))}
      </div>
      {refused && (
        <Hint>
          Your weight is already below the healthy range for your height, so this won’t plan a loss. Maintain or gain are here,
          and a doctor can help with anything else.
        </Hint>
      )}
      {a.goal !== 'maintain' && !(a.goal === 'lose' && refused) && (
        <div className="grid gap-2">
          <span className="text-small text-ink-2">How fast?</span>
          <div role="group" aria-label="How fast" className="flex flex-wrap gap-1.5">
            {PACE_CHIPS[a.unit].map((chip) => {
              const tooFast = fastest !== null && chipKg(chip.value) > fastest + 0.005
              return (
                <Chip key={chip.value} pressed={a.pace === chip.value} disabled={tooFast} onClick={() => patch({ pace: chip.value })} className="disabled:opacity-45">
                  {chip.label}
                </Chip>
              )
            })}
            <Chip pressed={a.pace === 'max'} disabled={fastest === null} onClick={() => patch({ pace: 'max' })} className="disabled:opacity-45">
              {a.goal === 'lose' ? 'As fast as is safe' : 'Fastest it plans'}
              {fastest !== null && ` · ${paceText(fastest, a.unit)}`}
            </Chip>
            <Chip pressed={a.pace === 'own'} onClick={() => patch({ pace: 'own' })}>
              My own pace
            </Chip>
          </div>
          {a.pace === 'own' && (
            <NumberField id="setup-pace" label="Pace" unit={`${a.unit} a week`} value={a.ownPace} onChange={(ownPace) => patch({ ownPace })} placeholder={a.unit === 'lb' ? '1.2' : '0.6'} />
          )}
          <Problem text={paceProblem(a)} />
          <Hint>
            {fastest !== null && max && weightKgNow !== null ? (
              <>
                The fastest it plans for you is <b className="text-ink">{paceText(fastest, a.unit)} a week</b>:{' '}
                {fastestReason(a.goal, weightKgNow, max)}.
              </>
            ) : preview === null ? (
              'Working out the fastest pace it will plan for you…'
            ) : null}
          </Hint>
        </div>
      )}
      <div className="grid gap-2">
        <span className="text-small text-ink-2">
          What matters most to you? <span className="text-ink-2">(optional)</span>
        </span>
        <div role="group" aria-label="What matters most" className="flex flex-wrap gap-1.5">
          {(
            [
              ['muscle', 'Keeping or building muscle'],
              ['scale', 'Just the number on the scale'],
            ] as const
          ).map(([focus, label]) => (
            <Chip key={focus} pressed={a.focus === focus} onClick={() => patch({ focus: a.focus === focus ? null : focus })}>
              {label}
            </Chip>
          ))}
        </div>
        <Hint>It only changes your protein target.</Hint>
      </div>
    </>
  )
}

function ExtrasQuestion({ a, patch }: { a: Answers; patch: (next: Partial<Answers>) => void }) {
  const remark = goalWeightRemark(a)
  return (
    <>
      {a.goal !== 'maintain' && (
        <div className="grid gap-1.5">
          <NumberField id="setup-goal-weight" label="Goal weight" unit={a.unit} value={a.goalWeight} onChange={(goalWeight) => patch({ goalWeight })} placeholder={a.unit === 'lb' ? 'e.g. 165' : 'e.g. 75'} />
          <Hint>Progress shows when you’d reach it.</Hint>
          <Problem text={remark?.text ?? null} warn={remark?.kind === 'warn'} />
        </div>
      )}
      <div className="grid gap-2">
        <span className="text-small text-ink-2">Also track carbs and fat?</span>
        <div role="group" aria-label="Carbs and fat" className="flex flex-wrap gap-1.5">
          <Chip pressed={a.carbsAndFat} onClick={() => patch({ carbsAndFat: true })}>
            Yes
          </Chip>
          <Chip pressed={!a.carbsAndFat} onClick={() => patch({ carbsAndFat: false })}>
            Just calories and protein
          </Chip>
        </div>
      </div>
      <TrackersPick a={a} patch={patch} />
      <ReminderPick a={a} patch={patch} />
    </>
  )
}

function TrackersPick({ a, patch }: { a: Answers; patch: (next: Partial<Answers>) => void }) {
  return (
    <div className="grid gap-2">
      <span className="text-small text-ink-2">What else do you want to track? The weigh-in is always on.</span>
      <div role="group" aria-label="Trackers" className="flex flex-wrap gap-1.5">
        {TRACKERS.map(({ key, name }) => (
          <Chip key={key} pressed={a.trackers.includes(key)} onClick={() => patch({ trackers: withTracker(a.trackers, key, !a.trackers.includes(key)) })}>
            {name}
          </Chip>
        ))}
      </div>
      <Hint>Change it any time with {CHANGE_TRACKERS}, at the bottom of Today.</Hint>
    </div>
  )
}

function ReminderPick({ a, patch }: { a: Answers; patch: (next: Partial<Answers>) => void }) {
  return (
    <div className="grid gap-2">
      <span className="text-small text-ink-2">Remind me to weigh in</span>
      <div role="group" aria-label="Weigh-in reminder" className="flex flex-wrap gap-1.5">
        <Chip pressed={!a.remind} onClick={() => patch({ remind: false })}>
          No thanks
        </Chip>
        <Chip pressed={a.remind} onClick={() => patch({ remind: true })}>
          Yes, each morning
        </Chip>
      </div>
      {a.remind && (
        <label htmlFor="setup-remind" className="flex items-center gap-2">
          <span className="text-ink-2">at</span>
          <input id="setup-remind" type="time" value={a.remindAt} onChange={(event) => patch({ remindAt: event.target.value })} className={cn(FIELD, 'w-[140px]')} />
        </label>
      )}
      <Hint>It shows on the Weigh-in card, nowhere else.</Hint>
    </div>
  )
}

function TargetSummary({
  a,
  preview,
  failed,
  waking,
  onRetry,
  max,
}: {
  a: Answers
  preview: BodyTargets | null
  failed: boolean
  waking: boolean
  onRetry: () => void
  max: { loss: number; gain: number; floorKcal: number } | null
}) {
  if (failed) {
    return (
      <div className="grid gap-2">
        <Problem text="Couldn't work it out. Check your connection, then try again." />
        <Button variant="secondary" className="justify-self-start" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }
  if (waking || !preview || preview.target_calories === null) {
    return (
      <div aria-live="polite" className="grid gap-2 rounded-control border-[1.5px] border-rule p-3">
        <span className="font-semibold">Working it out…</span>
        {waking && (
          <>
            <span className="text-small text-ink-2">Waking the server. It’s on a free plan and naps a lot. About a minute.</span>
            <WakeSegments />
          </>
        )}
      </div>
    )
  }
  const w = weightKg(a) ?? 0
  const asked = paceKg(a, a.goal === 'lose' ? max?.loss ?? null : max?.gain ?? null)
  const applied = preview.applied_rate_kg_per_week ?? 0
  const cut = asked !== null && Math.abs(asked) - Math.abs(applied) > 0.005
  const floor = preview.floor_kcal ?? 0
  // The floor raised the target only when the estimated burn is itself
  // below it; a loss is never planned past the floor (calculations.py).
  const raised = preview.tdee !== null && preview.tdee < floor
  const ref = preview.protein_reference_kg ?? w
  const pace =
    a.goal === 'maintain' || applied === 0
      ? 'To stay where you are.'
      : `${applied < 0 ? 'Losing' : 'Gaining'} about ${paceText(applied, a.unit)} a week.`
  return (
    <div aria-live="polite" className="grid gap-1.5 rounded-control border-[1.5px] border-rule p-3">
      <span className="text-small text-ink-2">Your daily target</span>
      <span className="text-field-number text-[26px]">
        {Math.round(preview.target_calories).toLocaleString()} kcal · {Math.round(preview.protein_g ?? 0)} g protein
      </span>
      {preview.protein_low_g != null && preview.protein_high_g != null && (
        <span className="text-small text-ink-2">
          Protein: anywhere from {Math.round(preview.protein_low_g)} to {Math.round(preview.protein_high_g)} g a day is fine for
          your goal.
          {ref < w - 0.5 && ` It’s worked out from ${Math.round(ref)} kg, the weight at a BMI of 30 for your height, because body fat needs no protein.`}
        </span>
      )}
      <span className="text-small text-ink-2">
        {pace} You burn about {Math.round(preview.tdee ?? 0).toLocaleString()} kcal a day, by the formula; after about two weeks it
        measures your real burn.
      </span>
      {cut && max && asked !== null && (
        <span className="text-small">
          You asked to {a.goal === 'lose' ? 'lose' : 'gain'} {paceText(asked, a.unit)} a week; {fastestReason(a.goal, w, max)}, so it
          plans {paceText(applied, a.unit)}.
        </span>
      )}
      {raised && (
        <span className="text-small">
          Raised to {Math.round(floor).toLocaleString()} kcal, the lowest target it sets for you; your estimated burn of{' '}
          {Math.round(preview.tdee ?? 0).toLocaleString()} kcal is below it.
        </span>
      )}
    </div>
  )
}
