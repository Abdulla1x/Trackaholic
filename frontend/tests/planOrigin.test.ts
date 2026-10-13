// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planOrigin, plansLink } from '../src/lib/planOrigin.ts'

const TODAY = '2026-10-13'

test('the link carries the day, the form and where it was opened', () => {
  assert.equal(plansLink('2026-10-12', 'compensating', 'day'), '/you/plans?plan=2026-10-12&kind=compensating&from=day')
  assert.equal(plansLink(TODAY, 'planned', 'today'), `/you/plans?plan=${TODAY}&kind=planned&from=today`)
})

test('opened from Day in detail, it returns to that day', () => {
  assert.deepEqual(planOrigin('day', '2026-10-12', TODAY), { to: '/day/2026-10-12', label: 'Back to the day' })
})

test('opened from Today, it returns to Today, on the day Today was showing', () => {
  assert.deepEqual(planOrigin('today', TODAY, TODAY), { to: '/', label: 'Back to Today' })
  assert.deepEqual(planOrigin('today', '2026-10-12', TODAY), { to: '/?day=2026-10-12', label: 'Back to Today' })
})

test('opened from You, or from anything unknown, it stays the planner under You', () => {
  assert.equal(planOrigin(null, '2026-10-12', TODAY), null)
  assert.equal(planOrigin('elsewhere', '2026-10-12', TODAY), null)
})

test('a day that is not a date sends nowhere', () => {
  assert.equal(planOrigin('day', null, TODAY), null)
  assert.equal(planOrigin('day', '//evil.example', TODAY), null)
  assert.equal(planOrigin('day', '2026-10-12/../../admin', TODAY), null)
})
