import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readSeen, seenTarget, targetMove } from '../src/lib/targetMoves.ts'
import type { BodyTargets } from '../src/types.ts'

const base: BodyTargets = {
  missing: [],
  bmi: 24,
  bmr: 1750,
  tdee: 2975,
  target_calories: 2425,
  protein_g: 144,
  carbs_g: null,
  fat_g: null,
  weight_kg: 80,
  weight_date: '2026-10-11',
  clamped_reason: null,
  tdee_source: 'estimated',
  tdee_estimated: 2975,
  tdee_basis: null,
  applied_rate_kg_per_week: -0.5,
  floor_kcal: 1500,
  goal_reached: false,
  loss_refused: false,
}

test('the daily drift of a weigh-in says nothing', () => {
  const before = seenTarget(base, 2425)
  const now = seenTarget({ ...base, tdee: 2970 }, 2420)
  assert.equal(targetMove(before, now, base), null)
})

test('nothing seen before says nothing', () => {
  assert.equal(targetMove(null, seenTarget(base, 2425), base), null)
})

test('the burn becoming measured is named, with both burns', () => {
  const measured = { ...base, tdee: 2690, tdee_source: 'measured' as const, target_calories: 2140 }
  const move = targetMove(seenTarget(base, 2425), seenTarget(measured, 2140), measured)
  assert.deepEqual(move, { kind: 'measured', from: 2425, to: 2140, measured: 2690, estimated: 2975 })
})

test('reaching the goal weight is named', () => {
  const reached = { ...base, goal_reached: true, applied_rate_kg_per_week: 0, target_calories: 2975 }
  assert.equal(targetMove(seenTarget(base, 2425), seenTarget(reached, 2975), reached)?.kind, 'goal')
})

test('a limit starting to decide the target is named with the server’s reason', () => {
  const capped = { ...base, clamped_reason: 'You asked to lose 1 kg a week; 1% of your body weight a week is the most it plans, so it plans 0.79 kg.' }
  const move = targetMove(seenTarget(base, 1875), seenTarget(capped, 2105), capped)
  assert.equal(move?.kind, 'limit')
  assert.match(move?.kind === 'limit' ? (move.reason ?? '') : '', /0.79 kg/)
})

test('a stored memory that is not one reads as none', () => {
  assert.equal(readSeen('{"x":1}'), null)
  assert.equal(readSeen('nope'), null)
  assert.deepEqual(readSeen(JSON.stringify(seenTarget(base, 2425))), seenTarget(base, 2425))
})
