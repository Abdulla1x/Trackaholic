import type { Calibration } from '../types.ts'
import { CALIBRATION_MIN_CORRECTIONS } from './limits.ts'

export { CALIBRATION_MIN_CORRECTIONS }

/** Where the AI accuracy screen stands: locked until at least one macro has a
 *  rate, with how many corrected estimates there are towards the minimum and
 *  the server's own sentence about it. Calories and protein are refused
 *  separately, so the further along of the two is the one that counts. */
export function accuracyProgress(data: Calibration): { locked: boolean; have: number; reason: string } {
  const locked = data.calories.coverage_pct === null && data.protein.coverage_pct === null
  const have = Math.max(data.calories.corrected, data.protein.corrected)
  const reason = data.unavailable_reason ?? data.calories.unavailable_reason ?? data.protein.unavailable_reason ?? ''
  return { locked, have: Math.min(have, CALIBRATION_MIN_CORRECTIONS), reason }
}

/** The one line Progress shows for it. */
export function accuracySummary(data: Calibration): string {
  const progress = accuracyProgress(data)
  if (progress.locked) return `${progress.have} of ${CALIBRATION_MIN_CORRECTIONS} corrected estimates so far`
  const pct = data.calories.coverage_pct ?? data.protein.coverage_pct ?? 0
  return `${Math.round(pct)}% of ${data.calories.coverage_pct !== null ? 'calorie' : 'protein'} estimates in range`
}
