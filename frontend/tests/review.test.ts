// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hideReview, reviewHidden } from '../src/lib/dismissals.ts'
import { checkFigure, checkLabel, checkStatus, lastWeekEnd, reviewEndFrom, reviewHeadline, reviewLocked } from '../src/lib/review.ts'
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

test('every day of a week reviews the Monday-to-Sunday week before it', () => {
  // 2026-10-12 is a Monday. Monday to Saturday all point at the Sunday just
  // gone; the Sunday is still in its own week, so it points a week back.
  for (const today of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']) {
    assert.equal(lastWeekEnd(today), '2026-10-11', today)
  }
  assert.equal(lastWeekEnd('2026-10-18'), '2026-10-11')
  assert.equal(lastWeekEnd('2026-10-19'), '2026-10-18')
})

test('the reviewed week crosses month and year ends', () => {
  assert.equal(lastWeekEnd('2026-10-01'), '2026-09-27')
  assert.equal(lastWeekEnd('2026-11-02'), '2026-11-01')
  assert.equal(lastWeekEnd('2026-11-01'), '2026-10-25')
  assert.equal(lastWeekEnd('2027-01-01'), '2026-12-27')
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

test("hiding the card lasts for that week only, and storage that throws shows it", () => {
  const store = new Map<string, string>()
  const fake = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })
  try {
    assert.equal(reviewHidden('2026-10-11'), false)
    hideReview('2026-10-11')
    assert.equal(reviewHidden('2026-10-11'), true)
    // The next week has a different end, so its card is back.
    assert.equal(reviewHidden('2026-10-18'), false)

    const broken = () => {
      throw new Error('SecurityError')
    }
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: broken, setItem: broken, removeItem: broken },
      configurable: true,
    })
    hideReview('2026-10-11')
    assert.equal(reviewHidden('2026-10-11'), false)
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage')
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
