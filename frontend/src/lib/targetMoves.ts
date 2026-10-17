import type { BodyTargets } from '../types.ts'

// "Your target moved": said only when something named moved it (decided
// 2026-10-11), never for the small daily change every weigh-in makes to an
// automatic target. Three things are named: the burn becoming measured,
// reaching the goal weight, and a limit starting or stopping deciding the
// target. Pure, so the rule can be tested.

/** What the target was the last time this device showed it. */
export interface SeenTarget {
  kcal: number
  source: 'estimated' | 'measured'
  reached: boolean
  /** Which limit decided the target, if one did. */
  limit: 'pace' | 'floor' | 'underweight' | null
}

export function seenTarget(t: BodyTargets, kcal: number): SeenTarget {
  const floor = t.floor_kcal ?? 0
  const limit = t.loss_refused
    ? 'underweight'
    : t.clamped_reason?.includes('You asked to')
      ? 'pace'
      : t.tdee !== null && floor > 0 && t.tdee < floor
        ? 'floor'
        : null
  return { kcal: Math.round(kcal), source: t.tdee_source, reached: t.goal_reached === true, limit }
}

export type TargetMove =
  | { kind: 'measured'; from: number; to: number; measured: number; estimated: number }
  | { kind: 'goal'; from: number; to: number }
  | { kind: 'limit'; from: number; to: number; reason: string | null }

/** The named change between what was seen and what is set now, or null:
 *  nothing seen before, no change, or only the daily drift. */
export function targetMove(before: SeenTarget | null, now: SeenTarget, t: BodyTargets): TargetMove | null {
  if (!before || before.kcal === now.kcal) return null
  const moved = { from: before.kcal, to: now.kcal }
  if (before.source === 'estimated' && now.source === 'measured' && t.tdee !== null) {
    return { kind: 'measured', ...moved, measured: Math.round(t.tdee), estimated: Math.round(t.tdee_estimated ?? t.tdee) }
  }
  if (!before.reached && now.reached) return { kind: 'goal', ...moved }
  if (before.limit !== now.limit) {
    // The server's own sentence for the limit, without its goal-reached and
    // measured-burn parts, which have their own notes.
    const reason = now.limit === null ? null : (t.clamped_reason ?? null)
    return { kind: 'limit', ...moved, reason }
  }
  return null
}

export function readSeen(raw: string | null): SeenTarget | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SeenTarget
    return typeof parsed.kcal === 'number' ? parsed : null
  } catch {
    return null
  }
}
