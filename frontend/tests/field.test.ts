// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FIELD } from '../src/ui/field.ts'

// In Tailwind v4, `outline-2` takes its style from `--tw-outline-style`, and
// `focus:outline-none` sets that to `none` on every focus, keyboard included.
// With both in the string, a tabbed-into field computes `outline-style: none`
// and the ring the class list promises never draws.
test('a text field keeps its keyboard focus ring', () => {
  const classes = FIELD.split(/\s+/)
  assert.ok(!classes.includes('focus:outline-none'))
  assert.ok(classes.includes('focus-visible:outline-2'))
  assert.ok(classes.includes('focus-visible:outline-action'))
})
