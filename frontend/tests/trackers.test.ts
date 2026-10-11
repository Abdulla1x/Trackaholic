import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  asksForTrackers,
  canChooseTrackers,
  legacyTrackers,
  shownTrackers,
  withTracker,
} from '../src/lib/trackers.ts'

test('a chosen list is shown as chosen, in Today order', () => {
  assert.deepEqual(shownTrackers({ trackers: ['supplements', 'water'] }, false), ['water', 'supplements'])
  assert.deepEqual(shownTrackers({ trackers: [] }, true), [])
})

test('before a choice, the old cards stay: supplements only with something to tick', () => {
  assert.deepEqual(shownTrackers({ trackers: null }, false), ['water', 'steps'])
  assert.deepEqual(shownTrackers({ trackers: null }, true), ['water', 'steps', 'supplements'])
  // The live API has no field at all: same cards.
  assert.deepEqual(shownTrackers({}, true), legacyTrackers(true))
})

test('only an account the server marks "not chosen yet" is asked', () => {
  assert.equal(asksForTrackers({ trackers: null }), true)
  assert.equal(asksForTrackers({}), false)
  assert.equal(asksForTrackers({ trackers: [] }), false)
})

test('the choice can only be changed where the API can store it', () => {
  assert.equal(canChooseTrackers({}), false)
  assert.equal(canChooseTrackers({ trackers: null }), true)
  assert.equal(canChooseTrackers({ trackers: ['steps'] }), true)
})

test('turning one on or off keeps the rest and the order', () => {
  assert.deepEqual(withTracker(['steps'], 'water', true), ['water', 'steps'])
  assert.deepEqual(withTracker(['water', 'steps'], 'water', false), ['steps'])
  assert.deepEqual(withTracker(['water'], 'water', true), ['water'])
})
