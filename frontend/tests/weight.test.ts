// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NO_PROJECTION, pointsFrom, projectionCaption, weightRangeStart } from '../src/lib/weight.ts'
import type { GoalProjection, WeightTrend } from '../src/types.ts'

const trend = (projection: Partial<GoalProjection>, rate: number | null = -0.4): WeightTrend => ({
  points: [],
  latest_trend_kg: 78,
  weekly_rate_kg: rate,
  point_count: 30,
  projection: { ...NO_PROJECTION, ...projection },
})

test('a weigh-in made today counts: seven days are today and the six before', () => {
  assert.equal(weightRangeStart(7, '2026-10-11'), '2026-10-05')
  assert.equal(weightRangeStart(null, '2026-10-11'), null)
})

test('the range slices points by date and never recomputes them', () => {
  const points = ['2026-10-04', '2026-10-05', '2026-10-11'].map((date) => ({ date, weight_kg: 78, trend_kg: 78 }))
  assert.deepEqual(
    pointsFrom(points, '2026-10-05').map((point) => point.date),
    ['2026-10-05', '2026-10-11'],
  )
  assert.equal(pointsFrom(points, null).length, 3)
})

test('the projection sentence follows the status the server gave', () => {
  assert.match(projectionCaption(trend({ status: 'no_goal' }), 'kg'), /Set a goal weight/)
  assert.equal(
    projectionCaption(trend({ status: 'on_course', remaining_kg: -3, reach_date: '2026-12-14' }), 'kg', '2026-10-11', 'en-US'),
    '3.0 kg to lose. At your measured -0.40 kg/week, around December 14, 2026.',
  )
  assert.equal(
    projectionCaption(trend({ status: 'stale', from_date: '2026-09-27' }), 'kg', '2026-10-11'),
    'Your last weigh-in was 14 days ago, so there is no current rate to project from.',
  )
})

test('it speaks the reader’s unit', () => {
  assert.match(projectionCaption(trend({ status: 'moving_away', remaining_kg: 2 }), 'lb'), /^4\.4 lb to gain/)
})

test('a response with no projection at all reads as no goal, not a crash', () => {
  const old = { ...trend({}), projection: undefined } as unknown as WeightTrend
  assert.match(projectionCaption(old, 'kg'), /Set a goal weight/)
})
