import assert from 'node:assert/strict'
import { test } from 'node:test'

import { targetSum } from '../src/lib/targetSum.ts'
import type { BodyTargets } from '../src/types.ts'

// The server's answer for 80 kg, 180 cm, 36, male, Active, asking 1.5 kg.
const preview: BodyTargets = {
  missing: [],
  bmi: 24.7,
  bmr: 1750,
  tdee: 2975,
  target_calories: 2095,
  protein_g: 144,
  carbs_g: null,
  fat_g: null,
  weight_kg: 80,
  weight_date: null,
  clamped_reason: null,
  tdee_source: 'estimated',
  tdee_estimated: 2975,
  tdee_basis: null,
  applied_rate_kg_per_week: -0.8,
  max_loss_kg_per_week: 0.8,
  max_gain_kg_per_week: 0.4,
  floor_kcal: 1500,
  protein_g_per_kg: 1.8,
  protein_low_g: 128,
  protein_high_g: 176,
  protein_reference_kg: 80,
}

test('the sum uses the server’s own figures', () => {
  const sum = targetSum(preview)!
  assert.equal(sum.rest, 1750)
  assert.equal(sum.multiplier, 1.7)
  assert.equal(sum.paceKcal, -880)
  assert.equal(sum.burn + sum.paceKcal, sum.target)
  assert.equal(sum.raised, false)
  assert.equal(sum.measured, null)
})

test('a measured burn is the one the target starts from', () => {
  const sum = targetSum({ ...preview, tdee: 2690, tdee_source: 'measured', target_calories: 1810 })!
  assert.equal(sum.measured, 2690)
  assert.equal(sum.estimated, 2975)
  assert.equal(sum.burn, 2690)
})

test('a burn below the floor is raised to it', () => {
  const sum = targetSum({ ...preview, tdee: 1150, tdee_estimated: 1150, bmr: 1000, target_calories: 1200, floor_kcal: 1200, applied_rate_kg_per_week: 0 })!
  assert.equal(sum.raised, true)
})

test('no sum without the numbers it needs', () => {
  assert.equal(targetSum({ ...preview, bmr: null }), null)
  assert.equal(targetSum({ ...preview, protein_g_per_kg: undefined }), null)
})

test('with your own protein the sum is still the worked-out one, and yours sits beside it', () => {
  const sum = targetSum({ ...preview, protein_g: 200 }, true)!
  assert.equal(sum.protein, 144)
  assert.equal(sum.ownProtein, 200)
  assert.equal(targetSum(preview)!.ownProtein, null)
})
