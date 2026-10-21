// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isInvalidSession } from '../src/auth/session.ts'

test('only a 401 means the stored login is no good', () => {
  assert.equal(isInvalidSession({ status: 401 }), true)
})

test('an unreachable or failing server says nothing about the login', () => {
  // 0 is the client's "no HTTP response happened": a dead network, a timeout,
  // or Render's edge refusing a restarting instance without CORS headers.
  for (const status of [0, 429, 500, 502, 503]) {
    assert.equal(isInvalidSession({ status }), false, `status ${status}`)
  }
  assert.equal(isInvalidSession(new Error('boom')), false)
  assert.equal(isInvalidSession(null), false)
  assert.equal(isInvalidSession(undefined), false)
})
