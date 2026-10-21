// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SETTLE_MS, settleDelay } from '../src/lib/settle.ts'

test('a change after a quiet spell is acted on at once', () => {
  assert.equal(settleDelay(Number.POSITIVE_INFINITY), 0)
  assert.equal(settleDelay(SETTLE_MS), 0)
  assert.equal(settleDelay(5_000), 0)
})

test('a change hard on the heels of another waits the full window', () => {
  // The full window, not what is left of it: each tap restarts the wait, so a
  // held arrow loads nothing until it is let go.
  assert.equal(settleDelay(0), SETTLE_MS)
  assert.equal(settleDelay(120), SETTLE_MS)
  assert.equal(settleDelay(SETTLE_MS - 1), SETTLE_MS)
})

test('the window can be set per caller', () => {
  assert.equal(settleDelay(150, 100), 0)
  assert.equal(settleDelay(50, 100), 100)
})
