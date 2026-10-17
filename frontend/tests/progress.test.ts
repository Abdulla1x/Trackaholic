// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_RANGE, everyDay, foodWindow, RANGES, resolveRange } from '../src/lib/progress.ts'

test('the page opens on 30 days when nothing says otherwise', () => {
  assert.equal(DEFAULT_RANGE, '30')
  assert.equal(resolveRange(null, null).key, '30')
})

test('the address wins over the remembered range, which wins over the default', () => {
  assert.equal(resolveRange('90', '365').key, '90')
  assert.equal(resolveRange(null, '365').key, '365')
  assert.equal(resolveRange('all', null).days, null)
})

test('anything unknown falls through, by value and not by position', () => {
  assert.equal(resolveRange('14', 'nonsense').key, '30')
  // The default is found by its key, so a range added at the front of the
  // list cannot become the default by accident.
  assert.notEqual(RANGES[0].key, DEFAULT_RANGE)
  assert.equal(resolveRange('', '').key, DEFAULT_RANGE)
})

test('food leaves today out: the window ends yesterday', () => {
  assert.deepEqual(foodWindow(7, '2026-10-11'), { start: '2026-10-04', end: '2026-10-10' })
  assert.deepEqual(foodWindow(30, '2026-10-11'), { start: '2026-09-11', end: '2026-10-10' })
  assert.deepEqual(foodWindow(null, '2026-10-11'), { start: null, end: '2026-10-10' })
})

test('every day of a window is listed, gaps included, across a month end', () => {
  assert.deepEqual(everyDay('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  assert.equal(everyDay('2026-09-11', '2026-10-10').length, 30)
})
