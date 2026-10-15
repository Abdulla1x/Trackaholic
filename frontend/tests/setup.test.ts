import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  answered,
  autoSettings,
  birthProblem,
  emptyAnswers,
  fastestReason,
  goalWeightRemark,
  heightProblem,
  lossRefused,
  ownNumbersProblem,
  ownReady,
  ownSettings,
  paceKg,
  paceProblem,
  paceText,
  parseNumber,
  previewRequest,
  regionUnit,
  screenFrom,
  splitRest,
  weightProblem,
  type Answers,
} from '../src/lib/setup.ts'
import type { Settings } from '../src/types.ts'

const TODAY = '2026-10-11'
const filled = (over: Partial<Answers> = {}): Answers => ({
  ...emptyAnswers('kg'),
  weight: '80',
  heightCm: '180',
  birthDate: '1990-05-04',
  sex: 'male',
  activity: 'moderate',
  ...over,
})

test('units follow the region: lb in the US, Liberia and Myanmar', () => {
  assert.equal(regionUnit('en-US'), 'lb')
  assert.equal(regionUnit('my-MM'), 'lb')
  assert.equal(regionUnit('en-GB'), 'kg')
  assert.equal(regionUnit('ar-AE'), 'kg')
  assert.equal(regionUnit('en'), 'kg')
})

test('the address names a screen, and anything else starts at the beginning', () => {
  assert.equal(screenFrom('height'), 'height')
  assert.equal(screenFrom('own'), 'own')
  assert.equal(screenFrom('nonsense'), 'start')
  assert.equal(screenFrom(null), 'start')
})

test('numbers accept a decimal comma and refuse words', () => {
  assert.equal(parseNumber('80,4'), 80.4)
  assert.equal(parseNumber(' 72 '), 72)
  assert.equal(parseNumber('eighty'), null)
  assert.equal(parseNumber(''), null)
})

test('typos are caught on the question they were made on', () => {
  assert.equal(weightProblem(filled({ weight: '8000' })), "That doesn't look right for a weight in kg. Check for a typo.")
  assert.equal(weightProblem(filled()), null)
  assert.match(heightProblem(filled({ heightCm: '18' })) ?? '', /between 100 and 272 cm/)
  // 80 lb typed as kg with 5 ft 10 typed as cm: a BMI that can't be real.
  assert.match(heightProblem(filled({ weight: '400', heightCm: '110' })) ?? '', /BMI of 331.*lb and ft/)
  assert.equal(birthProblem(filled({ birthDate: '2027-01-01' }), TODAY), 'That date is in the future.')
  assert.match(birthProblem(filled({ birthDate: '1900-01-01' }), TODAY) ?? '', /over 122/)
  assert.equal(birthProblem(filled(), TODAY), null)
})

test('feet and inches become centimetres', () => {
  const a = { ...filled(), unit: 'lb' as const, weight: '176', feet: '5', inches: '11' }
  assert.equal(heightProblem(a), null)
  assert.equal(previewRequest(a, null)?.height_cm, 180.3)
  assert.equal(previewRequest(a, null)?.weight_kg, 79.832)
})

test('pace: chips, own, and the fastest it plans', () => {
  assert.equal(paceKg(filled({ goal: 'lose', pace: '0.5' }), null), -0.5)
  assert.equal(paceKg(filled({ goal: 'gain', pace: 'own', ownPace: '0.3' }), null), 0.3)
  assert.equal(paceKg(filled({ goal: 'lose', pace: 'max' }), 0.8), -0.8)
  assert.equal(paceKg(filled({ goal: 'lose', pace: 'max' }), null), null)
  assert.equal(paceKg(filled({ goal: 'maintain' }), null), 0)
  assert.equal(Math.round(paceKg({ ...filled(), unit: 'lb', goal: 'lose', pace: '1' }, null)! * 1000), -454)
  assert.match(paceProblem(filled({ pace: 'own', ownPace: '75' })) ?? '', /looks like a goal weight/)
})

test('no loss is offered below a healthy BMI', () => {
  assert.equal(lossRefused(filled({ weight: '55' })), true)
  assert.equal(answered('goal', filled({ weight: '55', goal: 'lose', pace: '0.5' }), TODAY, null), false)
  assert.equal(answered('goal', filled({ weight: '55', goal: 'gain', pace: '0.25' }), TODAY, null), true)
})

test('a goal weight on the wrong side is asked about; a low one only remarked on', () => {
  assert.equal(goalWeightRemark(filled({ goal: 'lose', goalWeight: '85' }))?.kind, 'ask')
  assert.equal(goalWeightRemark(filled({ goal: 'gain', goalWeight: '75' }))?.kind, 'ask')
  assert.equal(goalWeightRemark(filled({ goal: 'lose', goalWeight: '55' }))?.kind, 'warn')
  assert.equal(goalWeightRemark(filled({ goal: 'lose', goalWeight: '75' })), null)
  assert.equal(answered('extras', filled({ goal: 'lose', goalWeight: '85' }), TODAY, null), false)
})

test('the preview waits for every answer, and asks about maintaining until a pace is picked', () => {
  assert.equal(previewRequest(filled({ sex: null }), null), null)
  assert.equal(previewRequest(filled(), null)?.goal_rate_kg_per_week, 0)
  assert.equal(previewRequest(filled({ pace: '0.5' }), null)?.goal_rate_kg_per_week, -0.5)
})

const base = {
  calorie_goal: 2000,
  protein_goal: 150,
  carbs_goal: 250,
  fat_goal: 70,
  track_carbs: false,
  track_fat: false,
  weight_unit: 'kg',
  targets_auto: false,
  target_set: false,
  trackers: [],
} as unknown as Settings

test('working it out turns automatic targets on and says the target was chosen', () => {
  const saved = autoSettings(base, filled({ pace: '0.5', trackers: ['water'], remind: true }), -0.5)
  assert.equal(saved.targets_auto, true)
  assert.equal(saved.target_set, true)
  assert.equal(saved.goal_rate_kg_per_week, -0.5)
  assert.deepEqual(saved.trackers, ['water'])
  assert.equal(saved.weigh_in_reminder_time, '07:30')
  assert.equal(saved.calorie_goal, 2000, 'the goals are written by the server, not here')
})

test('own numbers must fit inside the calories', () => {
  assert.match(ownNumbersProblem(filled({ ownCalories: '1500', ownProtein: '400' })) ?? '', /1,600 kcal, more than 1,500/)
  assert.equal(ownNumbersProblem(filled({ ownCalories: '2200', ownProtein: '160' })), null)
  const rest = splitRest(2200, 160)
  const withRest = filled({ carbsAndFat: true, ownCalories: '2200', ownProtein: '160', ownCarbs: String(rest.carbs), ownFat: String(rest.fat) })
  assert.equal(ownNumbersProblem(withRest), null, 'the suggested split always fits')
  assert.equal(ownReady(withRest), true)
  assert.match(ownNumbersProblem(filled({ ownCalories: '20000', ownProtein: '150' })) ?? '', /typo/)
})

test('own numbers are kept as typed, with automatic targets off', () => {
  const saved = ownSettings(base, filled({ ownCalories: '2000', ownProtein: '150' }))
  assert.equal(saved.targets_auto, false)
  assert.equal(saved.target_set, true, 'stated even when they equal the signup defaults')
  assert.equal(saved.calorie_goal, 2000)
})

test('the fastest pace is explained by whichever limit decided it', () => {
  // 80 kg: 1% is 0.8 kg, under the 1 kg cap.
  assert.match(fastestReason('lose', 80, { loss: 0.8, gain: 0.4, floorKcal: 1500 }), /1% of your body weight/)
  // 150 kg: 1% would be 1.5, so the kilo decides.
  assert.match(fastestReason('lose', 150, { loss: 1, gain: 0.75, floorKcal: 1500 }), /^1 kg a week/)
  // A small burn: the floor decides before 1% does.
  assert.match(fastestReason('lose', 60, { loss: 0.3, gain: 0.3, floorKcal: 1200 }), /below 1,200 kcal/)
  // Underweight: the +500 kcal rule gives more than half a percent.
  assert.match(fastestReason('gain', 50, { loss: 0, gain: 0.455, floorKcal: 1200 }), /extra 500 kcal/)
  assert.match(fastestReason('gain', 80, { loss: 0.8, gain: 0.4, floorKcal: 1500 }), /half a percent/)
})

test('a pace reads in the person’s unit', () => {
  assert.equal(paceText(-0.8, 'kg'), '0.8 kg')
  assert.equal(paceText(0.8, 'lb'), '1.8 lb')
})
