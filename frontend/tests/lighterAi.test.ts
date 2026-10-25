// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  backLabel,
  caveatLines,
  clearDayYes,
  dayYesLine,
  gatePasses,
  mainOutCopy,
  noteItems,
  quantified,
  readDayYes,
  writeDayYes,
} from '../src/lib/lighterAi.ts'

// Local times, so the today/tomorrow checks hold in any time zone the tests run in.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute)
const iso = (date: Date) => date.toISOString()

test('the gate passes a note with an amount on every item', () => {
  assert.equal(gatePasses('150 g chicken breast, 200 g cooked rice, 1 tbsp olive oil, 100 g cucumber salad'), true)
  assert.equal(gatePasses('2 eggs\n1 slice toast'), true)
  // A leading count names an amount too ("two bananas").
  assert.equal(gatePasses('two bananas'), true)
})

test('the gate fails a name, an empty note, or one item without an amount', () => {
  assert.equal(gatePasses(''), false)
  assert.equal(gatePasses('   '), false)
  assert.equal(gatePasses('Chicken machboos'), false)
  assert.equal(gatePasses('2 eggs and toast'), false)
  // Round 2's x16, strict on purpose: "no skin" is an item with no amount.
  assert.equal(gatePasses('Chicken thighs, 200 g cooked, no skin'), false)
})

test('items split on commas, lines, plus, "and" and "with", as round 2 did', () => {
  assert.deepEqual(noteItems('rice + 100 g chicken with salad and 1 cup tea\nbread'), [
    'rice',
    '100 g chicken',
    'salad',
    '1 cup tea',
    'bread',
  ])
  // "and" inside a word is not a split.
  assert.deepEqual(noteItems('100 g brandy'), ['100 g brandy'])
  assert.equal(quantified('half cup yogurt'), true)
  assert.equal(quantified('1.5 kg lamb'), true)
  assert.equal(quantified('a g'), true)
  assert.equal(quantified('3 g'), true)
  assert.equal(quantified('salad'), false)
})

test('the caveat is short with amounts, stronger without, and names what was sent', () => {
  assert.equal(caveatLines('150 g chicken, 200 g rice', 0).length, 1)
  const name = caveatLines('Chicken machboos', 0)
  assert.equal(name.length, 2)
  assert.match(name[0] ?? '', /from a name alone/)
  assert.match(caveatLines('', 1)[0] ?? '', /from a photo alone/)
  // A photo with a note that lacks amounts is still judged by the note.
  assert.match(caveatLines('chicken and rice', 2)[0] ?? '', /from a name alone/)
})

test("the reset is today or tomorrow, on the reader's own clock", () => {
  assert.equal(backLabel(iso(at(26, 11)), at(25, 23), 'en-US'), '11:00 AM tomorrow')
  assert.equal(backLabel(iso(at(26, 11)), at(26, 2), 'en-US'), '11:00 AM today')
  assert.equal(backLabel(iso(at(26, 4)), at(25, 20), 'en-GB'), '4:00 tomorrow')
  assert.equal(backLabel(iso(at(28, 12)), at(25, 20), 'en-US'), '12:00 PM on Wednesday')
})

test('each reason gets its own head and line', () => {
  const now = at(25, 20)
  const back = iso(at(26, 11))
  assert.deepEqual(mainOutCopy({ reason: 'daily_quota', back_at: back }, now, 'en-US'), {
    head: 'The main AI is out for today',
    line: "Google's free daily limit for it is used up across the app. It's back at 11:00 AM tomorrow.",
  })
  assert.deepEqual(mainOutCopy({ reason: 'app_limit', back_at: iso(at(26, 4)) }, now, 'en-US'), {
    head: 'The main AI is out for today',
    line: "The app's shared daily AI allowance is used up. It's back at 4:00 AM tomorrow.",
  })
  // Busy has no time: Google may take requests again in minutes.
  assert.deepEqual(mainOutCopy({ reason: 'busy', back_at: back }, now, 'en-US'), {
    head: 'The main AI is overloaded right now',
    line: 'Google is turning requests away. You can try again in a few minutes.',
  })
})

test('the rest-of-today line says the main AI is back only when it is out for the day', () => {
  const now = at(25, 20)
  const until = iso(at(26, 11))
  assert.equal(
    dayYesLine({ until, reason: 'daily_quota' }, now, 'en-US'),
    'Using the lighter AI until the main AI is back at 11:00 AM tomorrow.',
  )
  assert.equal(dayYesLine({ until, reason: 'busy' }, now, 'en-US'), 'Using the lighter AI until 11:00 AM tomorrow.')
})

test('a yes for the rest of today lasts until the reset, per account', () => {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    configurable: true,
  })
  try {
    const until = iso(at(26, 11))
    assert.equal(readDayYes(7, at(25, 20)), null)
    writeDayYes(7, { reason: 'busy', back_at: until })
    assert.deepEqual(readDayYes(7, at(25, 20)), { until, reason: 'busy' })
    // Another account on the same phone has not said yes.
    assert.equal(readDayYes(8, at(25, 20)), null)
    // Past the reset it is forgotten, and stays forgotten.
    assert.equal(readDayYes(7, at(26, 11)), null)
    assert.equal(store.size, 0)
    writeDayYes(7, { reason: 'daily_quota', back_at: until })
    clearDayYes(7)
    assert.equal(readDayYes(7, at(25, 20)), null)
    // Something unreadable is dropped rather than trusted.
    store.set('lighterUntil:7', '{nope')
    assert.equal(readDayYes(7, at(25, 20)), null)
    assert.equal(store.size, 0)
  } finally {
    Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
