import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ScreenBar from '../components/shell/ScreenBar'
import { CHANGE_TRACKERS } from '../lib/trackers'
import Block from '@/ui/block'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Block>
      <h2 className="text-[17px] font-bold">{title}</h2>
      {children}
    </Block>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="grid list-disc gap-1.5 pl-5 text-ink-2 marker:text-ink-2">{children}</ul>
}

const LINK = 'font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

/** How Trackaholic works: an optional page instead of a tour (decided
 *  2026-10-11). Linked from Getting started, the "what's next" moment, You,
 *  and the one-time "The new Trackaholic" popup. Every feature it names
 *  exists under the name it uses here; keep the two in step. */
export default function HowItWorks() {
  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="How Trackaholic works" back="/" backLabel="Back to Today" />

      <Section title="Log a meal">
        <p>
          Tap Log and describe what you ate with the grams, say it, or take a photo; you check the AI's numbers before
          anything is saved.
        </p>
        <List>
          <li>Grams beat guesses. “150 g chicken” is worth more than any photo, and a voice note counts.</li>
          <li>Photos miss oil, butter, sauce and sugar. Say them.</li>
          <li>Foods you save are used as facts: attach the packaged ones and the AI only judges the portion.</li>
          <li>To fix an estimate, change your note and press Refine rather than starting again.</li>
          <li>If the AI isn't available, search a food or enter the numbers by hand.</li>
        </List>
      </Section>

      <Section title="Read Today">
        <p>
          The big number is what's left of your daily target; tap it for the day in detail.
        </p>
        <p className="text-ink-2">Over is fine. The week evens out.</p>
      </Section>

      <Section title="Progress fills in as you log">
        <List>
          <li>Seven weigh-ins draw your weight trend.</li>
          <li>
            Ten weigh-ins over at least two weeks, with most of those days logged, and the app measures what you actually
            burn instead of estimating it.
          </li>
          <li>Your first logged day starts a weekly review.</li>
          <li>Ten AI estimates you've checked and corrected show how accurate the AI is for you.</li>
        </List>
      </Section>

      <Section title="A guide, not a rule">
        <p>
          Your target comes from your setup answers and follows your weight. In You → Daily targets you can change it,
          type your own, or type just your protein.
        </p>
        <p>
          <Link to="/how-it-works/target" className={LINK}>
            How your target is worked out
          </Link>
        </p>
      </Section>

      <Section title="Things you might have missed">
        <List>
          <li>
            <b className="text-ink">Saved meals.</b> Open a meal and choose Keep as a saved meal; it's then one tap from
            Log.
          </li>
          <li>
            <b className="text-ink">Meal codes.</b> Share as a code from a meal screen; anyone can paste the code into
            Log.
          </li>
          <li>
            <b className="text-ink">Calorie plans.</b> Over on one day? Spread it across the next few from the day in
            detail, or plan a bigger day ahead.
          </li>
          <li>
            <b className="text-ink">Steps history.</b> Import months of steps at once from a file with a date and a step
            count for each day, in You → Steps.
          </li>
          <li>
            <b className="text-ink">The weekly review.</b> A short summary of last week, on Today until you close it and
            in Progress any time.
          </li>
          <li>
            <b className="text-ink">AI accuracy.</b> How far the AI's estimates were from what you saved, in Progress.
          </li>
          <li>
            <b className="text-ink">Trackers.</b> Water, steps and supplements: {CHANGE_TRACKERS}, at the bottom of
            Today or in You.
          </li>
          <li>
            <b className="text-ink">Units and a weigh-in reminder.</b> kg or lb on the You page, and a reminder on the
            Weigh-in card in You → Weigh-in reminder.
          </li>
        </List>
      </Section>

      <Section title="When to ask a doctor">
        <List>
          <li>
            <b className="text-ink">Pregnant or breastfeeding:</b> these targets aren't built for that. Your midwife or
            doctor can set one; you can still log meals.
          </li>
          <li>
            <b className="text-ink">Kidney disease, diabetes medication, a GLP-1 drug, or after weight-loss surgery:</b>{' '}
            protein and calorie targets may need your doctor or dietitian.
          </li>
          <li>If you use food or weight to cope with how you feel, the NHS advises talking to a GP.</li>
          <li>Trackaholic gives estimates to help you plan. It isn't medical advice.</li>
        </List>
      </Section>
    </div>
  )
}
