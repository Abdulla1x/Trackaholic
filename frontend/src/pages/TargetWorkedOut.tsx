import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import ScreenBar from '../components/shell/ScreenBar'
import { targetSum, type TargetSum } from '../lib/targetSum'
import { targetIsSet } from '../lib/today'
import { TDEE_MIN_LOGGED_FRACTION, TDEE_MIN_SPAN_DAYS, TDEE_MIN_WEIGH_INS } from '../lib/limits'
import { formatWeight, unitLabel, type WeightUnit } from '../lib/units'
import { useSettings } from '../settings/SettingsContext'
import type { BodyTargets } from '../types'
import Block from '@/ui/block'
import Retry from '@/ui/retry'
import { n } from '@/lib/format'
import Screen from '@/ui/screen'

function Step({ title, sum, children }: { title: string; sum: ReactNode; children: ReactNode }) {
  return (
    <Block>
      <h2 className="text-title">{title}</h2>
      <p className="text-row-number">{sum}</p>
      <p className="text-small text-ink-2">{children}</p>
    </Block>
  )
}

/** Where it was opened from, so Back returns there: setup passes its preview
 *  along, since nothing is saved yet. */
interface Arrival {
  from?: string
  preview?: BodyTargets
  unit?: WeightUnit
}

/** How your target is worked out: the target as a sum in the person's own
 *  numbers (lib/targetSum.ts), each step in plain words with its source.
 *  Opened from setup's target, the day in detail, and How Trackaholic works. */
export default function TargetWorkedOut() {
  const { settings } = useSettings()
  const arrival = (useLocation().state as Arrival | null) ?? {}
  const [saved, setSaved] = useState<BodyTargets | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    setFailed(false)
    api
      .getBodyTargets()
      .then(setSaved)
      .catch(() => setFailed(true))
  }, [])
  useEffect(() => {
    if (!arrival.preview) load()
  }, [arrival.preview, load])

  const targets = arrival.preview ?? saved
  const sum = targets
    ? targetSum(targets, !arrival.preview && Boolean(settings?.targets_auto && settings.protein_own))
    : null
  const unit = arrival.unit ?? settings?.weight_unit ?? 'kg'
  const typed = !arrival.preview && settings !== null && targetIsSet(settings) && !settings.targets_auto

  let body: ReactNode
  if (failed) {
    body = (
      <Retry
        text="Couldn't load your numbers. Check your connection, then try again."
        onRetry={load}
        role="alert"
        className="py-3"
      />
    )
  } else if (!targets) {
    body = <div aria-hidden="true" className="my-4 h-40 rounded-control bg-track motion-safe:animate-pulse" />
  } else if (!sum) {
    body = (
      <Block>
        <p>Your numbers show here once you've answered setup's questions.</p>
        <p>
          <Link to="/setup" className="font-semibold text-action underline underline-offset-3">
            Set your target
          </Link>
        </p>
      </Block>
    )
  } else {
    body = <Steps sum={sum} unit={unit} />
  }

  return (
    <Screen>
      <ScreenBar title="How your target is worked out" back={arrival.from ?? '/how-it-works'} backLabel="Back" />
      {typed && settings && (
        <Block>
          <p>
            You typed your own target: {n(settings.calorie_goal)} kcal and {n(settings.protein_goal)} g protein. It stays as
            you set it. Below is what working it out from your profile would give.
          </p>
        </Block>
      )}
      {body}
    </Screen>
  )
}

function Steps({ sum, unit }: { sum: TargetSum; unit: WeightUnit }) {
  const weight = `${formatWeight(sum.weightKg, unit)} ${unitLabel(unit)}`
  const pace = `${formatWeight(Math.abs(sum.paceKg), unit)} ${unitLabel(unit)}`
  return (
    <>
      <Step title="1. What you burn at rest" sum={`${n(sum.rest)} kcal a day`}>
        From your weight ({weight}), height, age and sex, using the Mifflin-St Jeor formula, the one most often within
        10% of measured resting burn.
      </Step>
      {sum.measured === null ? (
        <Step title="2. What you burn in a day" sum={`${n(sum.rest)} × ${sum.multiplier.toFixed(2)} = ${n(sum.estimated)} kcal`}>
          The {sum.multiplier.toFixed(2)} is your activity level, from measured data on how much people with that kind of
          week burn (FAO/WHO/UNU). It's an estimate until the app can measure yours.
        </Step>
      ) : (
        <Step title="2. What you burn in a day" sum={`${n(sum.measured)} kcal, measured`}>
          Worked out from your own weigh-ins and logged meals. The formula guessed {n(sum.estimated)} kcal; the measurement
          replaces it.
        </Step>
      )}
      <Step
        title="3. Your pace"
        sum={
          sum.raised
            ? `${n(sum.target)} kcal, the lowest it sets`
            : sum.paceKg === 0
              ? `${n(sum.target)} kcal, to stay where you are`
              : `${n(sum.burn)} ${sum.paceKcal < 0 ? '−' : '+'} ${n(Math.abs(sum.paceKcal))} = ${n(sum.target)} kcal`
        }
      >
        {sum.raised
          ? `Your burn is below ${n(sum.floor)} kcal, the lowest target it sets for you, so it plans that.`
          : sum.paceKg === 0
            ? 'Maintaining means eating what you burn.'
            : `A kilo of body weight is about 7,700 kcal, so ${pace} a week is about ${n(Math.abs(sum.paceKcal))} kcal a day. It never plans losing more than 1% of your body weight a week or over 1 kg, gaining more than half a percent (or 500 kcal a day below a healthy weight), or going below 1,200 kcal for women and 1,500 for men (1,500 for anyone 113 kg or more).`}
      </Step>
      <Step title="4. Protein" sum={`${sum.proteinPerKg} g × ${sum.proteinFromKg} kg = ${n(sum.protein)} g`}>
        Grams per kilo for your goal
        {sum.proteinFromKg < sum.weightKg - 0.5 &&
          ', from the weight at a BMI of 30 for your height, because body fat needs no protein'}
        .{sum.proteinLow !== null && sum.proteinHigh !== null && ` Anywhere from ${n(sum.proteinLow)} to ${n(sum.proteinHigh)} g a day is fine.`}
        {sum.ownProtein !== null &&
          ` You chose your own: ${n(sum.ownProtein)} g. Carbs and fat fill the rest, and protein above the worked-out amount comes out of fat first.`}
      </Step>
      <Block>
        <h2 className="text-title">5. After about two weeks</h2>
        <p>
          The formula is a starting guess. Once you have {TDEE_MIN_WEIGH_INS} weigh-ins over at least {TDEE_MIN_SPAN_DAYS} days,
          with {Math.round(TDEE_MIN_LOGGED_FRACTION * 100)}% of those days logged, the app measures your real burn from them
          and uses that instead.
        </p>
        <p className="text-small text-ink-2">
          Sources: resting burn, Frankenfield et al. 2005; activity, FAO/WHO/UNU 2001; pace, Helms et al. 2014 and the CDC;
          gaining, Iraki et al. 2019 and the NHS; protein, Morton et al. 2018, Iraki et al. 2019, Leidy et al. 2015 and Weijs
          2024. Not medical advice.
        </p>
      </Block>
    </>
  )
}
