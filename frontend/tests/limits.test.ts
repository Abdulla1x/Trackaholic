// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TDEE_MIN_SPAN_DAYS, TDEE_MIN_WEIGH_INS, tdeeLoggedDaysNeeded } from '../src/lib/limits.ts'

test('the measured-burn minimums match the server', () => {
  assert.equal(TDEE_MIN_WEIGH_INS, 10)
  assert.equal(TDEE_MIN_SPAN_DAYS, 14)
})

test('logged days needed: at least 10, else 70% of the span', () => {
  // A short span counts as the minimum 14, which is 9.8 -> 10.
  assert.equal(tdeeLoggedDaysNeeded(3), 10)
  assert.equal(tdeeLoggedDaysNeeded(14), 10)
  assert.equal(tdeeLoggedDaysNeeded(20), 14)
  assert.equal(tdeeLoggedDaysNeeded(28), 20)
})

test('halves round to even, as Python does', () => {
  // 0.7 x 15 = 10.5: Python's round gives 10; Math.round would give 11.
  assert.equal(tdeeLoggedDaysNeeded(15), 10)
  // 0.7 x 25 = 17.5 -> 18, the even neighbour.
  assert.equal(tdeeLoggedDaysNeeded(25), 18)
})
