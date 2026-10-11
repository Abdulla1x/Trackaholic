import assert from 'node:assert/strict'
import { test } from 'node:test'

import { gettingStartedView, readMemory } from '../src/lib/firstUse.ts'

test('a new account sees the steps, or one row after Not now', () => {
  assert.equal(gettingStartedView(false, false, {}), 'steps')
  assert.equal(gettingStartedView(false, null, { later: true }), 'row')
})

test('it stays after the target is set, until the first meal', () => {
  assert.equal(gettingStartedView(true, false, { open: true }), 'steps')
  assert.equal(gettingStartedView(true, null, { open: true }), 'steps')
  assert.equal(gettingStartedView(true, true, { open: true }), 'next')
  assert.equal(gettingStartedView(true, true, { open: true, later: true }), 'next')
})

test('an account that already has a target never sees it', () => {
  assert.equal(gettingStartedView(true, false, {}), 'hidden')
  assert.equal(gettingStartedView(true, true, {}), 'hidden')
})

test('Done is final', () => {
  assert.equal(gettingStartedView(false, false, { done: true }), 'hidden')
  assert.equal(gettingStartedView(true, true, { open: true, done: true }), 'hidden')
})

test('a broken memory reads as none', () => {
  assert.deepEqual(readMemory('{nope'), {})
  assert.deepEqual(readMemory(null), {})
  assert.deepEqual(readMemory('{"later":true}'), { later: true })
})
