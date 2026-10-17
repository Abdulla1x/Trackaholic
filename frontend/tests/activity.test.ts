import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ACTIVITY_OPTIONS, activityLine, activityName } from '../src/lib/activity.ts'

test('the levels run from least to most active, matching the server keys', () => {
  assert.deepEqual(
    ACTIVITY_OPTIONS.map((option) => option.value),
    ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  )
})

test('every level has its own name', () => {
  const names = ACTIVITY_OPTIONS.map((option) => option.name)
  assert.equal(new Set(names).size, names.length)
})

test('a stored level reads as its plain name', () => {
  assert.equal(activityName('moderate'), 'Active')
  assert.equal(activityName('very_active'), 'Extremely active')
})

test('a dropdown line keeps the description lower case after the name', () => {
  assert.equal(
    activityLine({
      value: 'sedentary',
      name: 'Mostly sitting',
      description: 'Desk job or at home, little walking, no workouts',
    }),
    'Mostly sitting: desk job or at home, little walking, no workouts',
  )
})
