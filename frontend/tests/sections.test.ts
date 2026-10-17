// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SECTION_HOME, routeKey, screenDepth, screenMotion, sectionFor } from '../src/components/shell/sections.ts'

test('each tab owns its pages', () => {
  assert.equal(sectionFor('/'), 'today')
  assert.equal(sectionFor('/setup'), 'today')
  for (const path of ['/progress', '/progress/weigh-ins', '/progress/review']) assert.equal(sectionFor(path), 'progress', path)
  assert.equal(sectionFor('/log'), 'log')
  for (const path of ['/you', '/you/targets', '/you/plans', '/whats-new']) {
    assert.equal(sectionFor(path), 'you', path)
  }
})

test('pages outside the four tabs light none of them', () => {
  for (const path of ['/admin', '/nope', '/youx', '/weights', '/logbook', '/progressx']) {
    assert.equal(sectionFor(path), null, path)
  }
})

test('every tab’s home is a page of that tab', () => {
  for (const [section, home] of Object.entries(SECTION_HOME)) assert.equal(sectionFor(home), section)
})

test('the day in detail and its meal screens belong to Today', () => {
  for (const path of ['/day/2026-10-09', '/day/2026-10-09/meal/12']) assert.equal(sectionFor(path), 'today', path)
  assert.equal(sectionFor('/days'), null)
})

test('every screen with a back arrow sits below its tab', () => {
  for (const path of ['/', '/progress', '/you', '/whats-new', '/admin']) assert.equal(screenDepth(path), 0, path)
  for (const path of ['/day/2026-10-10', '/setup', '/progress/weigh-ins', '/progress/days', '/progress/review', '/progress/accuracy', '/you/targets', '/you/body']) {
    assert.equal(screenDepth(path), 1, path)
  }
  assert.equal(screenDepth('/day/2026-10-10/meal/42'), 2)
  assert.equal(screenDepth('/how-it-works'), 1)
  assert.equal(screenDepth('/how-it-works/target'), 2)
  assert.equal(sectionFor('/how-it-works/target'), 'you')
})

test('pushing slides in, coming back slides back, a tab crossfades', () => {
  assert.equal(screenMotion(null, '/progress/days'), 'fade')
  assert.equal(screenMotion('/progress', '/progress/days'), 'push')
  assert.equal(screenMotion('/progress/days', '/progress'), 'back')
  assert.equal(screenMotion('/', '/day/2026-10-10'), 'push')
  assert.equal(screenMotion('/day/2026-10-10', '/day/2026-10-10/meal/42'), 'push')
  assert.equal(screenMotion('/day/2026-10-10/meal/42', '/day/2026-10-10'), 'back')
  assert.equal(screenMotion('/day/2026-10-10/meal/42', '/'), 'back')
  // Monday's review card on Today opens a Progress screen: a push.
  assert.equal(screenMotion('/', '/progress/review'), 'push')
  // Tabs crossfade, even from deep inside another tab.
  assert.equal(screenMotion('/', '/progress'), 'fade')
  assert.equal(screenMotion('/progress/review', '/'), 'fade')
  assert.equal(screenMotion('/day/2026-10-10/meal/42', '/you'), 'fade')
  // A settings screen is pushed from You, and its back arrow comes back.
  assert.equal(screenMotion('/you', '/you/body'), 'push')
  assert.equal(screenMotion('/you/body', '/you'), 'back')
  // A day's "Spread it" opens Calorie plans from Today: a push.
  assert.equal(screenMotion('/', '/you/plans'), 'push')
})

test('every screen has its own key, so each entrance plays', () => {
  assert.notEqual(routeKey('/you'), routeKey('/you/targets'))
  assert.notEqual(routeKey('/you/targets'), routeKey('/you/body'))
  assert.notEqual(routeKey('/progress'), routeKey('/progress/days'))
  assert.notEqual(routeKey('/day/2026-10-10'), routeKey('/day/2026-10-10/meal/42'))
})
