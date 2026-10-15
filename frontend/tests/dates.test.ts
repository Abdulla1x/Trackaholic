// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { timeLabel, dayDate, shortDate } from '../src/lib/dates.ts'

const now = new Date(2026, 9, 11)

test('a date this year reads as month and day', () => {
  assert.equal(shortDate('2026-09-28', now, 'en-US'), 'Sep 28')
  assert.equal(shortDate('2026-01-02', now, 'en-US'), 'Jan 2')
})

test('a date from another year carries its year', () => {
  assert.equal(shortDate('2025-12-31', now, 'en-US'), 'Dec 31, 2025')
})

test('the day is the calendar day written, not the UTC one', () => {
  // parseIsoDate builds local midnight; new Date(iso) would be UTC and read
  // as the day before anywhere west of Greenwich.
  assert.equal(shortDate('2026-03-01', now, 'en-US'), 'Mar 1')
})

test('it follows the language it is given', () => {
  assert.equal(shortDate('2026-09-28', now, 'en-GB'), '28 Sept')
})

test('anything that is not a YYYY-MM-DD date is shown as it came', () => {
  // A chart tick formatter calls this inside render, where a throw would take
  // the whole chart down.
  assert.equal(shortDate('09-28', now, 'en-US'), '09-28')
})

test('a day date carries its weekday', () => {
  assert.equal(dayDate('2026-10-10', 'en-US'), 'Sat, Oct 10')
  assert.equal(dayDate('2026-10-10', 'en-GB'), 'Sat 10 Oct')
})

// ICU versions differ on the space before AM/PM (U+202F or a plain space).
const spaced = (text: string) => text.replace(/\s/g, ' ')

test('a stored time reads in the device clock', () => {
  assert.equal(spaced(timeLabel('08:00', 'en-US')), '8:00 AM')
  assert.equal(spaced(timeLabel('22:05', 'en-US')), '10:05 PM')
  assert.equal(timeLabel('20:00', 'en-GB'), '20:00')
})

test('a time that is not HH:MM is shown as it came', () => {
  assert.equal(timeLabel('8am', 'en-US'), '8am')
})
