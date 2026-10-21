import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import CaloriesBand from '../components/today/CaloriesBand'
import DateBar from '../components/today/DateBar'
import NutritionLabel from '../components/today/NutritionLabel'
import MealList from '../components/today/MealList'
import ReviewCard from '../components/today/ReviewCard'
import WeighInCard from '../components/today/WeighInCard'
import GettingStarted from '../components/today/GettingStarted'
import TargetMovedNote from '../components/today/TargetMovedNote'
import TrackersSheet from '../components/today/TrackersSheet'
import StepsCard from '../components/StepsCard'
import SupplementsCard from '../components/SupplementsCard'
import WaterCard from '../components/WaterCard'
import { localIsoDate } from '../lib/dates'
import { gettingStartedView, readMemory, type GettingStartedMemory } from '../lib/firstUse'
import { lastWeekEnd } from '../lib/review'
import { readSeen, seenTarget, targetMove, type SeenTarget, type TargetMove } from '../lib/targetMoves'
import { accountKey, readLocal, writeLocal } from '../lib/storage'
import { useAuth } from '../auth/AuthContext'
import { useAppearance } from '../appearance/AppearanceContext'
import { canChooseTrackers, CHANGE_TRACKERS, shownTrackers } from '../lib/trackers'
import { countedMeals, dayTotals, planCaption, shownMeals, targetIsSet, viewedDay } from '../lib/today'
import { useSettings } from '../settings/SettingsContext'
import { useLogPanel } from '../components/log/useLogPanel'
import { onMealsChanged } from '../lib/mealEvents'
import type { Meal, PlanDay } from '../types'
import { useHeldDelete } from '../hooks/useHeldDelete'
import { useLiveMessage } from '../hooks/useLiveMessage'
import { useSettled } from '../hooks/useSettled'
import { cn } from '@/lib/utils'
import { useToast } from '../ui/toast'
import { DURATION } from '../lib/motion'
import { Button } from '@/ui/button'
import Retry from '@/ui/retry'

/** Waits for the Log panel to leave, then scrolls to the top of the page.
 *  Instant under reduced motion. Resolves once there, or after a second in
 *  case the scroll never arrives (a page too short to scroll, a user who grabs
 *  it), so the meals are never held back for long. */
function showTheTop(): Promise<void> {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return new Promise((resolve) => {
    window.setTimeout(
      () => {
        if (window.scrollY < 2) return resolve()
        window.scrollTo({ top: 0, behavior: still ? 'instant' : 'smooth' })
        const started = performance.now()
        const arrived = () => {
          if (window.scrollY < 2 || performance.now() - started > 1_000) resolve()
          else requestAnimationFrame(arrived)
        }
        requestAnimationFrame(arrived)
      },
      // The panel's close (DESIGN.md: 240 ms); under reduced motion it fades.
      still ? DURATION.reduced * 1000 : DURATION.base * 1000,
    )
  })
}

export default function Today() {
  const { settings, loading: settingsLoading, error: settingsError, reload: reloadSettings } = useSettings()
  const { appearance } = useAppearance()
  const Calories = appearance.style === 'label' ? NutritionLabel : CaloriesBand
  // Null until the day's first answer: an empty list and "not loaded yet"
  // must not look alike, or every load opens on "Nothing logged yet".
  const [meals, setMeals] = useState<Meal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)
  const [planDay, setPlanDay] = useState<PlanDay | null>(null)
  const [planFailed, setPlanFailed] = useState(false)
  // The day on show lives in the address (`?day=`, absent for today), so it
  // survives opening a meal and coming back, a reload, and the back button.
  // The Log panel's own `date` parameter is a different one: which day a new
  // meal is for.
  const [searchParams, setSearchParams] = useSearchParams()
  const [realToday, setRealToday] = useState(localIsoDate)
  // Two dates, on purpose. The date bar follows every tap (`pickedDate`); the
  // page loads and shows `viewedDate`, which waits until the taps stop. Each
  // day shown costs about six requests, and a held arrow used to fire them for
  // every day it passed: on 2026-10-21 that queue got the free instance
  // restarted three times (hooks/useSettled.ts).
  const pickedDate = viewedDay(searchParams.get('day'), realToday)
  const viewedDate = useSettled(pickedDate)
  const settling = pickedDate !== viewedDate
  const isToday = viewedDate === realToday
  // Replace rather than push: stepping back through a week should not leave a
  // week of history entries for the back button to walk through again.
  const showDay = (day: string) =>
    setSearchParams(
      (params) => {
        if (day >= localIsoDate()) params.delete('day')
        else params.set('day', day)
        return params
      },
      { replace: true },
    )
  // The Log panel opens over this page, on the day being viewed (useLogPanel
  // reads `?day=`), so a tap while looking at yesterday lands on yesterday.
  const { open: openLog } = useLogPanel()

  // Past midnight, "today" moves on. A page showing today (no `?day=`) follows
  // it when the tab regains focus; a day picked on purpose is in the address
  // and stays put. Same-string updates are no-ops.
  useEffect(() => {
    const refresh = () => setRealToday(localIsoDate())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  // `ready` holds the answer back until something has finished first: the
  // scroll that brings the day into view after a save, below.
  const load = useCallback((ready?: Promise<void>) => {
    setError(null)
    // A failed load must not masquerade as an empty day.
    Promise.all([api.getMeals(viewedDate), ready]).then(([fresh]) => setMeals(fresh)).catch(() => {
      setMeals(null)
      setError("Couldn't load your meals. Check your connection, then try again.")
    })
  }, [viewedDate])

  // The targets actually in force on the viewed day. These are NOT
  // settings.calorie_goal: a calorie plan adjusts a single day, and the
  // server composes the adjustment on top of the stored goals. Resolved
  // there and never recomputed here -- a second definition of these numbers
  // in the client is a second thing that can be wrong, and this one would be
  // wrong invisibly, as a gauge quietly drawn against the wrong target.
  //
  // Fetched again whenever the stored goals change, not only per day: a
  // weigh-in saved from this page rewrites them when targets are worked out
  // automatically, and the band must follow without a reload.
  const storedGoals = settings
    ? `${settings.calorie_goal}/${settings.protein_goal}/${settings.carbs_goal}/${settings.fat_goal}`
    : ''
  useEffect(() => {
    // Only the latest request may answer: two goal changes in quick
    // succession must not let the older response land last.
    let live = true
    api
      .getPlanDay(viewedDate)
      .then((day) => {
        if (!live) return
        setPlanDay(day)
        setPlanFailed(false)
      })
      .catch(() => {
        if (!live) return
        // Falls back to the stored goals, and SAYS SO under the gauge. A gauge
        // silently drawn against a target that may be wrong is the kind of
        // wrong nobody reports, because nothing about it looks wrong.
        setPlanDay(null)
        setPlanFailed(true)
      })
    return () => {
      live = false
    }
  }, [viewedDate, storedGoals])

  useEffect(() => {
    load()
  }, [load])

  // A save in the Log panel happens over this page, which never remounts.
  // A meal saved for the day on show is brought into view: the page goes to
  // the top, where the calories are, and only then takes the new meals, so the
  // digits roll and the gauge fills where they can be seen (found on a phone
  // test: from further down the page the save changed nothing visible). The
  // meals are fetched at once and held, not fetched after the scroll, so the
  // wait is the longer of the two rather than both. A save for another day
  // only refreshes: an edit can move a meal off the day on show.
  useEffect(
    () => onMealsChanged((change) => load(change.date === viewedDate ? showTheTop() : undefined)),
    [load, viewedDate],
  )

  // Delete and Undo (DESIGN.md). The meal screen's Delete comes back here
  // with the meal in router state; it is held, struck through, for ten
  // seconds before anything is sent (hooks/useHeldDelete.ts).
  // A refused delete is reported in a toast, not in the list's error slot:
  // that slot replaces the whole list, and the reload below clears it in the
  // same moment anyway, which is how the message used to vanish unseen. The
  // reload puts the meal back, so the toast and the list agree.
  const toast = useToast()
  const { held, gone, hold, undo, prune } = useHeldDelete((failure) => {
    if (failure) toast.show({ text: failure })
    load()
  })
  useEffect(() => {
    if (meals) prune(meals)
  }, [meals, prune])
  const [heldNote, setHeldNote] = useState<string | null>(null)
  useLiveMessage(heldNote)
  const location = useLocation()
  const navigate = useNavigate()
  const arriving = (location.state as { deleteMeal?: Meal } | null)?.deleteMeal
  useEffect(() => {
    if (!arriving) return
    hold(arriving)
    setHeldNote(`Deleted "${arriving.name}". Undo is there for ten seconds.`)
    // Spent: a reload or the back button must not delete it a second time.
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
  }, [arriving, hold, navigate, location.pathname, location.search])

  // Out of the totals the moment it is deleted, not ten seconds later, and
  // kept out until the server stops returning it.
  const consumed = dayTotals(countedMeals(meals ?? [], held?.meal.id, gone))

  // Checked at render rather than trusted from state. Two day-switches in
  // quick succession can land their responses out of order, and the late one
  // would otherwise draw this day's gauge against the other day's target --
  // silently, since a gauge gives no sign which day it was told about. The
  // stale value is dropped instead, and the goals fall back for the moment it
  // takes the right response to arrive.
  const dayPlan = planDay?.date === viewedDate ? planDay : null
  const goals = dayPlan ?? settings
  // Supplements is passed as "has something to tick" because its card checks
  // that itself before the choice existed; see shownTrackers.
  const trackers = settings ? shownTrackers(settings, true) : []
  const [choosing, setChoosing] = useState(false)

  // ----- First use -----
  // Getting started, remembered per account on this device (lib/firstUse.ts).
  const { user } = useAuth()
  const userId = user?.id ?? 0
  const memoryKey = accountKey('trackaholic_getting_started', userId)
  const [memory, setMemory] = useState<GettingStartedMemory>(() => readMemory(readLocal(memoryKey)))
  const remember = (next: GettingStartedMemory) => {
    const merged = { ...memory, ...next }
    setMemory(merged)
    writeLocal(memoryKey, JSON.stringify(merged))
  }
  const hasTarget = settings ? targetIsSet(settings) : true
  // Whether any meal was ever logged: today's list answers it at once when it
  // has one, the most recent meal otherwise. Asked only while it matters.
  const [everLogged, setEverLogged] = useState<boolean | null>(null)
  const asking = settings !== null && !memory.done && (!hasTarget || memory.open === true)
  useEffect(() => {
    if (!asking) return
    let live = true
    const check = () =>
      api
        .getRecentMeals(1)
        .then((recent) => live && setEverLogged(recent.length > 0))
        .catch(() => {})
    check()
    const stop = onMealsChanged(() => check())
    return () => {
      live = false
      stop()
    }
  }, [asking])
  const hasMeal = everLogged === true || (meals !== null && meals.length > 0) ? true : everLogged
  const started = settings && isToday ? gettingStartedView(hasTarget, hasMeal, memory) : 'hidden'
  useEffect(() => {
    if ((started === 'steps' || started === 'row') && !memory.open) remember({ open: true })
    // remember is recreated each render; `started` is what this follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])
  const gettingStarted = started !== 'hidden' && (
    <GettingStarted
      view={started}
      targetSet={hasTarget}
      hasMeal={hasMeal === true}
      onSetTarget={() => navigate('/setup')}
      onLog={() => openLog()}
      onLater={() => remember({ later: true })}
      onShow={() => remember({ later: false })}
      onDone={() => remember({ done: true })}
    />
  )

  // "Your target moved" (lib/targetMoves.ts): for automatic targets only,
  // compared with what this device last showed, per account. The daily drift
  // of a weigh-in is stored silently; a named change waits for "Got it".
  // The same answer says whether the target is waiting for a weigh-in.
  const [move, setMove] = useState<TargetMove | null>(null)
  const [pendingSeen, setPendingSeen] = useState<SeenTarget | null>(null)
  const [waitingForWeighIn, setWaitingForWeighIn] = useState(false)
  const seenKey = accountKey('trackaholic_target_seen', userId)
  const followsWeight = settings !== null && settings.targets_auto && targetIsSet(settings)
  const shownGoal = settings?.calorie_goal ?? 0
  useEffect(() => {
    if (!followsWeight) return
    let live = true
    api
      .getBodyTargets()
      .then((targets) => {
        if (!live) return
        setWaitingForWeighIn(targets.missing.includes('weight'))
        if (targets.target_calories === null) return
        const now = seenTarget(targets, shownGoal)
        const named = targetMove(readSeen(readLocal(seenKey)), now, targets)
        if (named) {
          setMove(named)
          setPendingSeen(now)
        } else writeLocal(seenKey, JSON.stringify(now))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [followsWeight, shownGoal, seenKey])
  const movedNote = move && isToday && (
    <TargetMovedNote
      move={move}
      onDismiss={() => {
        if (pendingSeen) writeLocal(seenKey, JSON.stringify(pendingSeen))
        setMove(null)
      }}
    />
  )

  // The First target moment: arriving from setup, the band counts up and its
  // gauge draws in. Once per account on this device, and the arrival is
  // cleared from history so a reload or Back does not replay it.
  const [countUp, setCountUp] = useState(false)
  const arrivedWithTarget = (location.state as { firstTarget?: boolean } | null)?.firstTarget === true
  useEffect(() => {
    if (!arrivedWithTarget) return
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    // Setup reached some other way (You -> Goals) still leaves the meal step.
    setMemory((now) => {
      const next = { ...now, open: true }
      writeLocal(memoryKey, JSON.stringify(next))
      return next
    })
    const playedKey = accountKey('trackaholic_first_target', userId)
    if (readLocal(playedKey)) return
    writeLocal(playedKey, '1')
    setCountUp(true)
    const end = window.setTimeout(() => setCountUp(false), 1000)
    return () => window.clearTimeout(end)
  }, [arrivedWithTarget, navigate, location.pathname, location.search, userId, memoryKey])


  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-y-2 desk:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] desk:gap-x-10 desk:gap-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 desk:col-span-2">
        <DateBar day={pickedDate} today={realToday} onChange={showDay} />
        {/* Above the calories until there is a target to show, then under
            them (chosen from the first-use prototype). */}
        {!hasTarget && gettingStarted}
        {/* The band needs both loads. A failed settings load says so here,
            since nothing else on Today does; a failed meals load leaves the
            slot empty, because the meal list below already says it and its
            Retry brings the band back too. Only a load still in flight pulses. */}
        {!settings && settingsError && !settingsLoading ? (
          <Retry
            text="Couldn't load your targets. Check your connection, then try again."
            onRetry={reloadSettings}
            role="alert"
          />
        ) : error && meals === null && !settling ? null : !settings || !goals || meals === null || settling ? (
          <div aria-hidden="true" className="-mx-4 h-[226px] bg-track/40 motion-safe:animate-pulse desk:mx-0 desk:h-[274px]" />
        ) : (
          // The Label style draws the calories as a nutrition label instead of
          // the band; both take the same day.
          <Calories
            day={viewedDate}
            isToday={isToday}
            eaten={consumed}
            targets={goals}
            targetSet={targetIsSet(settings)}
            firstTarget={countUp}
            caption={planCaption(dayPlan, planFailed)}
            trackCarbs={settings.track_carbs}
            trackFat={settings.track_fat}
          />
        )}
        {movedNote}
        {hasTarget && gettingStarted}
      </div>

      <MealList
        meals={settling ? null : meals && shownMeals(meals, held?.meal.id, gone)}
        error={settling ? null : error}
        onRetry={() => load()}
        isToday={isToday}
        showTimes={settings?.show_meal_times ?? true}
        trackCarbs={settings?.track_carbs ?? false}
        trackFat={settings?.track_fat ?? false}
        onLog={() => openLog()}
        held={
          held && {
            ...held,
            onUndo: () => {
              undo()
              setHeldNote(`"${held.meal.name}" is back.`)
            },
          }
        }
      />

      {/* The daily trackers, one per row, full width (0a).

          The right-hand column from 900px, below the meals on a phone. They
          sit below the calories because those are the primary targets, and
          below the meal list because that is what you came to read. These three
          are a glance, and a glance is what goes last. It used to sit ABOVE the
          meal list, which is how a phone ended up asking for five screens of
          scrolling before it would show you what you had eaten.

          NOTE this block used to describe itself as "the daily quick-logs",
          one word away from a dashboard card then called "Quick log" — two
          different features with nearly the same name in one file. That card is
          now "Saved meals", which settles it from the other end: these are
          trackers, and the thing that logs meals is named after meals.

          `viewedDate`, not today: the date bar's ◀ ▶ already move the whole page
          through time, and a tracker that ignored them would be the only part
          of this screen showing a different day from the rest. */}
      <div
        aria-busy={settling || undefined}
        className={cn('grid content-start grid-cols-[minmax(0,1fr)]', settling && 'opacity-50')}
      >
        {/* Above the trackers, from the first open of the week, until closed
            or opened (decided 2026-10-13 from a prototype), and only while
            looking at today. Keyed by the week, so a new week starts a fresh
            card. Not before a target is chosen: a review of a week against a
            target nobody picked has nothing honest to say. */}
        {isToday && settings && targetIsSet(settings) && (
          <ReviewCard key={lastWeekEnd(realToday)} end={lastWeekEnd(realToday)} />
        )}
        {/* First: the one tracker every account has, and the one with a
            reminder. */}
        <WeighInCard day={viewedDate} today={realToday} waitingForTarget={followsWeight && waitingForWeighIn} />
        {/* The rest are the ones the account chose (lib/trackers.ts). Not
            drawn until settings arrive, so a new account never sees cards
            flash up and vanish. */}
        {trackers.includes('water') && <WaterCard date={viewedDate} />}
        {trackers.includes('steps') && <StepsCard date={viewedDate} />}
        {/* Chosen, it shows how to set it up while it is empty. From before
            the choice, it renders nothing until there is something to tick,
            as it always did. */}
        {trackers.includes('supplements') && (
          <SupplementsCard date={viewedDate} chosen={settings?.trackers != null} />
        )}
        {settings && canChooseTrackers(settings) && (
          <>
            <Button variant="ghost" className="mt-3.5 w-full" onClick={() => setChoosing(true)}>
              {CHANGE_TRACKERS}
            </Button>
            <TrackersSheet open={choosing} onOpenChange={setChoosing} />
          </>
        )}
      </div>
    </div>
  )
}
