// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHECK_EVERY_MS, MIN_GAP_MS, shouldCheckForUpdate } from '../src/lib/updateCheck.ts'

const base = { now: 1_000_000, lastCheckAt: 1_000_000 - MIN_GAP_MS, online: true, installing: false }

test('checks once a minute has passed since the last check', () => {
  assert.equal(shouldCheckForUpdate(base), true)
  assert.equal(shouldCheckForUpdate({ ...base, lastCheckAt: base.now - MIN_GAP_MS + 1 }), false)
})

test('the hourly check is never throttled away', () => {
  assert.ok(CHECK_EVERY_MS > MIN_GAP_MS)
  assert.equal(shouldCheckForUpdate({ ...base, lastCheckAt: base.now - CHECK_EVERY_MS }), true)
})

test('no check while offline or while a new version is downloading', () => {
  assert.equal(shouldCheckForUpdate({ ...base, online: false }), false)
  assert.equal(shouldCheckForUpdate({ ...base, installing: true }), false)
})
