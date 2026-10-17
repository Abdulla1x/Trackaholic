import type { BodyTargets } from '../types.ts'

// "How your target is worked out": the target as a sum, in the person's own
// numbers, taken from what the server worked out (GET /settings/targets, or
// setup's preview). Nothing is recomputed here except the steps between the
// server's figures, so the page can never disagree with the target it
// explains.

export interface TargetSum {
  /** Resting burn (Mifflin-St Jeor). */
  rest: number
  /** The activity level's multiplier, as the server applied it. */
  multiplier: number
  /** The formula's daily burn. */
  estimated: number
  /** The burn measured from weigh-ins and meals, when there is one. */
  measured: number | null
  /** The burn the target starts from. */
  burn: number
  /** The planned weekly change, signed kg. */
  paceKg: number
  /** The pace as kcal a day, signed. */
  paceKcal: number
  target: number
  /** The target was lifted to the lowest it sets, above burn plus pace. */
  raised: boolean
  floor: number
  weightKg: number
  proteinPerKg: number
  proteinFromKg: number
  protein: number
  /** Protein you typed, while calories stay worked out; null when it's
   *  worked out too. */
  ownProtein: number | null
  proteinLow: number | null
  proteinHigh: number | null
}

const KCAL_PER_KG = 7700

/** The sum, or null when the server could not work one out (a missing
 *  profile answer, or the live API, which returns no limits). */
export function targetSum(t: BodyTargets, ownProtein = false): TargetSum | null {
  if (t.bmr === null || t.tdee === null || t.target_calories === null || t.weight_kg === null) return null
  if (t.protein_g === null || t.protein_g_per_kg == null) return null
  const estimated = t.tdee_estimated ?? t.tdee
  const paceKg = t.applied_rate_kg_per_week ?? 0
  const floor = t.floor_kcal ?? 0
  const burn = Math.round(t.tdee)
  const target = Math.round(t.target_calories)
  const planned = Math.round((paceKg * KCAL_PER_KG) / 7)
  const raised = burn + planned < floor && target <= Math.round(floor)
  // Shown as target minus burn, so the sum on the page always adds up to the
  // target the server set, whatever the rounding on the way.
  const paceKcal = raised ? planned : target - burn
  const proteinFromKg = Math.round((t.protein_reference_kg ?? t.weight_kg) * 10) / 10
  return {
    rest: Math.round(t.bmr),
    multiplier: Math.round((estimated / t.bmr) * 100) / 100,
    estimated: Math.round(estimated),
    measured: t.tdee_source === 'measured' ? Math.round(t.tdee) : null,
    burn,
    paceKg,
    paceKcal,
    target,
    raised,
    floor: Math.round(floor),
    weightKg: t.weight_kg,
    proteinPerKg: t.protein_g_per_kg,
    proteinFromKg,
    // With your own protein the server's protein_g is the typed number, so
    // the sum shows what working it out gives, and the typed number beside it.
    protein: ownProtein ? Math.round(t.protein_g_per_kg * proteinFromKg) : Math.round(t.protein_g),
    ownProtein: ownProtein ? Math.round(t.protein_g) : null,
    proteinLow: t.protein_low_g == null ? null : Math.round(t.protein_low_g),
    proteinHigh: t.protein_high_g == null ? null : Math.round(t.protein_high_g),
  }
}
