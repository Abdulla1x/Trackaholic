// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accuracyProgress, accuracySummary } from '../src/lib/accuracy.ts'
import type { Calibration, MacroCalibration } from '../src/types.ts'

const macro = (corrected: number, coverage: number | null): MacroCalibration => ({
  corrected,
  covered: 0,
  coverage_pct: coverage,
  coverage_low_pct: null,
  coverage_high_pct: null,
  median_abs_error_pct: null,
  median_signed_error_pct: null,
  unavailable_reason: coverage === null ? `${10 - corrected} more corrections needed.` : null,
})
const calibration = (calories: MacroCalibration, protein: MacroCalibration, reason: string | null = null): Calibration => ({
  analyses: 40,
  linked: 30,
  unreadable: 0,
  accepted_unchanged: 25,
  corrected: 5,
  calories,
  protein,
  by_confidence: [],
  unavailable_reason: reason,
})

test('locked below ten corrections, counting the further-along macro', () => {
  const data = calibration(macro(4, null), macro(6, null), 'Nothing to measure yet.')
  assert.deepEqual(accuracyProgress(data), { locked: true, have: 6, reason: 'Nothing to measure yet.' })
  assert.equal(accuracySummary(data), '6 of 10 corrected estimates so far')
})

test("a macro's own sentence stands in when there is no section-wide one", () => {
  assert.equal(accuracyProgress(calibration(macro(3, null), macro(1, null))).reason, '7 more corrections needed.')
})

test('one macro with a rate unlocks it', () => {
  const data = calibration(macro(12, 83.4), macro(9, null))
  assert.equal(accuracyProgress(data).locked, false)
  assert.equal(accuracySummary(data), '83% of calorie estimates in range')
})
