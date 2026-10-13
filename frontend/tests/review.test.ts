// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkFigure, checkLabel, checkStatus, isReviewDay, reviewEndFrom, reviewHeadline, reviewLocked } from '../src/lib/review.ts'
import type { ReviewCheck, WeeklyReview } from '../src/types.ts'

const check = (status: ReviewCheck['status']): ReviewCheck => ({
  key: 'x',
  status,
  value: null,
  target: null,
  unit: '',
  sample_days: 7,
  detail: '',
  unavailable_reason: null,
})
const review = (logged: number, statuses: ReviewCheck['status'][]): WeeklyReview => ({
  window_start: '2026-10-05',
  window_end: '2026-10-11',
  logged_days: logged,
  checks: statuses.map(check),
})

test('the card comes up on Mondays only', () => {
  assert.equal(isReviewDay('2026-10-12'), true)
  assert.equal(isReviewDay('2026-10-10'), false)
  assert.equal(isReviewDay('2026-10-11'), false)
})

test("the review page takes ?end= only for a real day before today", () => {
  const today = '2026-10-14'
  assert.equal(reviewEndFrom('2026-10-11', today), '2026-10-11')
  assert.equal(reviewEndFrom('2026-10-13', today), '2026-10-13')
  assert.equal(reviewEndFrom('2025-12-28', today), '2025-12-28')
  // Everything else is yesterday, the page's own default.
  for (const param of [null, '', 'junk', '2026-10-14', '2026-10-20', '2026-02-30', '2026-1-05', '2026-10-11x']) {
    assert.equal(reviewEndFrom(param, today), '2026-10-13', String(param))
  }
})

test('the headline counts what is off, and only judged checks', () => {
  assert.equal(reviewHeadline(review(7, ['on_track', 'on_track', 'note'])), '7 of 7 days logged. Nothing to fix this week. Carry on.')
  assert.equal(reviewHeadline(review(5, ['on_track', 'off_track', 'unknown'])), '5 of 7 days logged. 1 of 2 checks are off target.')
  assert.equal(reviewHeadline(review(3, ['off_track'])), '3 of 7 days logged. 1 of 1 check is off target.')
  assert.equal(reviewHeadline(review(2, ['unknown', 'note'])), '2 of 7 days logged.')
  assert.match(reviewHeadline(review(0, [])), /nothing to review yet/)
})

test('each check gets a heading, a word and a figure', () => {
  const days = { ...check('on_track'), key: 'logging', value: 6, target: 7, unit: 'days' }
  assert.equal(checkLabel(days), 'How much you logged')
  assert.equal(checkStatus(days), 'On track')
  assert.equal(checkFigure(days), '6 of 7')
  assert.equal(checkFigure({ ...check('off_track'), value: -0.35, unit: 'kg/week' }), '-0.35 kg/wk')
  assert.equal(checkFigure({ ...check('off_track'), value: 0.5, unit: 'kg/week' }), '+0.50 kg/wk')
  assert.equal(checkStatus(check('note')), null)
  assert.equal(checkFigure(check('unknown')), null)
  // A check the app has never heard of still renders, under its own key.
  assert.equal(checkLabel({ ...check('note'), key: 'sleep' }), 'sleep')
})

test('the review is locked only while the week has no meals logged', () => {
  // A new account: the logging check answers "off target" at 0 of 7.
  assert.equal(reviewLocked(review(0, ['off_track', 'unknown', 'note'])), true)
  assert.equal(reviewLocked(review(2, ['unknown', 'note', 'unknown'])), false)
})
