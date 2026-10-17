// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { n } from '../src/lib/format.ts'

// toLocaleString() follows the machine's locale, so these compare against it
// rather than a hard-coded "1,234".
const grouped = (1234).toLocaleString()

test('a whole number is rounded and grouped', () => {
  assert.equal(n(1234.4), grouped)
  assert.equal(n(1233.5), grouped)
})

test('it rounds half up, the way Math.round does', () => {
  assert.equal(n(2.5), '3')
  assert.equal(n(-2.5), (-2).toLocaleString())
})

test('decimals keep that many places, and no trailing zero', () => {
  assert.equal(n(13.26, 1), (13.3).toLocaleString())
  assert.equal(n(13.04, 1), (13).toLocaleString())
})
