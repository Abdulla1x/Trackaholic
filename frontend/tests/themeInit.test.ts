// Run with `npm test` (see photoSize.test.ts for how).
//
// public/theme-init.js runs before the app, so nothing else would notice if it
// broke: the page would just open in the wrong colours. It also repeats
// lib/appearance.ts, because a plain script in <head> cannot import. These
// tests run the real file against a fake document, storage and matchMedia,
// and hold the two copies to the same answers.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { APPEARANCE_KEY, PALETTES, parseAppearance, resolveTheme } from '../src/lib/appearance.ts'

// Compiled to dist-tests/tests/, so the sources are two levels up.
const script = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../../src/theme.css', import.meta.url), 'utf8')

type Attributes = Record<string, string>

/** Runs the script once and returns the attributes it set on <html>. `stored`
 *  is what localStorage holds; `throws` makes reading it throw, as Safari's
 *  blocked storage does. */
function run(stored: string | null, phoneIsDark: boolean, throws = false): Attributes {
  const attributes: Attributes = {}
  const context = {
    document: { documentElement: { setAttribute: (name: string, value: string) => (attributes[name] = value) } },
    localStorage: {
      getItem: (key: string) => {
        if (throws) throw new Error('SecurityError')
        return key === APPEARANCE_KEY ? stored : null
      },
    },
    window: { matchMedia: (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' && phoneIsDark }) },
  }
  vm.runInNewContext(script, context)
  return attributes
}

/** What the app's own functions say the attributes should be. */
function expected(stored: string | null, phoneIsDark: boolean): Attributes {
  const choice = parseAppearance(stored)
  const attributes: Attributes = { 'data-theme': resolveTheme(choice.theme, phoneIsDark) }
  if (choice.palette !== 'daylight') attributes['data-palette'] = choice.palette
  if (choice.style !== 'fields') attributes['data-style'] = choice.style
  return attributes
}

const CASES: [string, string | null][] = [
  ['nothing stored', null],
  ['not JSON', '{oops'],
  ['JSON but not an object', '"dark"'],
  ['null', 'null'],
  ['every field set', '{"theme":"dark","palette":"clay","style":"label"}'],
  ['light over the phone', '{"theme":"light","palette":"ember"}'],
  ['automatic', '{"theme":"auto","palette":"teal"}'],
  ['a removed palette', '{"theme":"dark","palette":"mono"}'],
  ['junk values', '{"theme":"sepia","palette":7,"style":"bold"}'],
]

test('the script and lib/appearance.ts give the same attributes', () => {
  for (const [name, stored] of CASES) {
    for (const phoneIsDark of [false, true]) {
      assert.deepEqual(run(stored, phoneIsDark), expected(stored, phoneIsDark), `${name}, phone ${phoneIsDark ? 'dark' : 'light'}`)
    }
  }
})

test('with nothing stored, Automatic follows the phone in Daylight and Fields', () => {
  assert.deepEqual(run(null, false), { 'data-theme': 'light' })
  assert.deepEqual(run(null, true), { 'data-theme': 'dark' })
})

test('a fixed theme ignores the phone', () => {
  assert.equal(run('{"theme":"light"}', true)['data-theme'], 'light')
  assert.equal(run('{"theme":"dark"}', false)['data-theme'], 'dark')
})

test('a palette that no longer exists falls back to Daylight and keeps the rest', () => {
  assert.deepEqual(run('{"theme":"dark","palette":"mono"}', false), { 'data-theme': 'dark' })
})

test('storage that throws still sets a theme', () => {
  assert.deepEqual(run('{"theme":"dark"}', true, true), { 'data-theme': 'dark' })
  assert.deepEqual(run('{"theme":"dark"}', false, true), { 'data-theme': 'light' })
})

test('the script, lib/appearance.ts and theme.css name the same palettes', () => {
  const inScript = JSON.parse(/var PALETTES = (\[[^\]]*\])/.exec(script)![1]!.replace(/'/g, '"')) as string[]
  const inCss = ['daylight', ...[...css.matchAll(/:root\[data-palette="(\w+)"\] \{/g)].map((m) => m[1]!)]
  const inApp = PALETTES.map((p) => p.id)
  assert.deepEqual(inScript, inApp)
  assert.deepEqual(inCss, inApp, 'theme.css blocks, in display order')
})
