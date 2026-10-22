// Run with `npm test` (see photoSize.test.ts for how).
//
// Every colour on screen comes from the theme's tokens (theme.css), so it
// follows the palette and light or dark. A fixed colour paints the same in
// every theme: before phase 3b's sweep, 27 files did, and in light mode their
// navy cards hid black text. Tailwind does not fail on a class whose token is
// missing, so nothing else would notice one coming back. These tests do.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

// Compiled to dist-tests/tests/, so src is two levels up.
const SRC = new URL('../../src/', import.meta.url)

const sources = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((path) => /\.(tsx?|css)$/.test(path))
  .map((path) => ({ path, text: readFileSync(new URL(path, SRC), 'utf8') }))

/** Every match of `pattern` in the sources, as "file:line: match". */
function hits(pattern: RegExp, files = sources): string[] {
  return files.flatMap(({ path, text }) =>
    text.split('\n').flatMap((line, index) =>
      [...line.matchAll(pattern)].map((match) => `${path}:${index + 1}: ${match[0]}`),
    ),
  )
}

test('no Tailwind palette colours (slate-900, emerald-400 and the like)', () => {
  const palette =
    /\b(?:bg|text|border|ring|fill|stroke|divide|from|to|via|outline|placeholder|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g
  assert.deepEqual(hits(palette), [])
})

test('no white or black text, grounds or borders', () => {
  // A scrim over the page (bg-black/45) is the one use: it darkens whatever is
  // under it in either theme. Only the bare, opaque colours are refused.
  assert.deepEqual(hits(/\b(?:bg|text|border)-(?:white|black)\b(?!\/)/g), [])
})

test('none of the old fixed dark tokens', () => {
  const old = /\b(?:bg|text|border|ring|divide|fill|stroke|outline|placeholder)-(?:app|surface|raised|line|line-strong|ink-muted|ink-faint|brand|brand-ink)\b|--color-(?:app|surface|raised|line|line-strong|ink-muted|ink-faint|brand|brand-ink|calories|protein|carbs|fat|water|steps|supplements)\b/g
  assert.deepEqual(hits(old), [])
})

test('no hex colours in code', () => {
  // theme.css is where the hexes live. Three files in code may hold them:
  // photoDownscale paints the white under a photo before it is encoded as a
  // JPEG, which has no transparency (pixels, not something on screen);
  // palettes.ts mirrors theme.css for the Appearance swatches, which
  // themeTokens.test.ts holds to theme.css value for value; and GoogleG is
  // Google's logo, whose colours its branding rules fix in every theme.
  const allowed = new Set(['lib/photoDownscale.ts', 'lib/palettes.ts', 'components/auth/GoogleG.tsx'])
  const code = sources.filter(({ path }) => /\.tsx?$/.test(path) && !allowed.has(path))
  assert.deepEqual(hits(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g, code), [])
})
