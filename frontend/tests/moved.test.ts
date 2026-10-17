// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NEW_ORIGIN, isOldAddress } from '../src/lib/moved.ts'

test('only the old address shows the moved notice', () => {
  assert.equal(isOldAddress('macros-calculator-mu.vercel.app'), true)
  assert.equal(isOldAddress('trackaholic.app'), false)
  assert.equal(isOldAddress('www.trackaholic.app'), false)
  assert.equal(isOldAddress('localhost'), false)
  // A preview deployment of the same project is not the old address.
  assert.equal(isOldAddress('macros-calculator-git-main-abdulla1xx.vercel.app'), false)
})

test('the notice links to the new address over https, with no path', () => {
  assert.equal(NEW_ORIGIN, 'https://trackaholic.app')
})
