#!/usr/bin/env node
//
// The two images at the top of the README, one per GitHub theme:
//
//   <dir>/wordmark-{light,dark}.png   the app's wordmark, as the README's title
//   <dir>/hero-{light,dark}.png       three phone screens side by side
//
// scripts/screenshots.mjs calls this at the end of every run, so the top of
// the README is retaken with everything else and cannot drift from the app.
// It can also run on its own, to rebuild both from the captures already in
// <dir> without seeding an account or calling the model:
//
//   node scripts/readme-images.mjs screenshots --estimate-top 1101
//
// --estimate-top is where the Estimate block starts in the phone AI capture,
// in CSS pixels. A full screenshots.mjs run measures it on the live page; on
// its own this script cannot see the page, so it has to be told, and it is
// required rather than defaulted because a stale guess crops the estimate in
// half without any error. Read it off the capture, or run screenshots.mjs.
//
// Setup is screenshots.mjs's: playwright-core at the repo root and a
// chromium headless shell. See that file's header.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { findExecutable, loadChromium } from './lib/harness.mjs'

const REPO = new URL('..', import.meta.url).pathname
const THEMES = ['light', 'dark']

// One phone screen at the capture's MOBILE viewport. The captures are taken at
// deviceScaleFactor 2, so everything here is drawn at 2x too.
const PHONE = { width: 390, height: 844 }

/** The three screens the hero shows, left to right, and how far down each
 *  capture its crop starts. Today and Progress open on what matters; the AI
 *  capture is the whole Log panel, so it is cropped to the estimate. */
const heroScreens = (estimateTop) => [
  ['today', 0],
  ['ai-analysis', estimateTop],
  ['progress', 0],
]

const dataUri = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`

/** Crop one phone screen out of a whole-page capture, as a PNG data URI. */
async function cropPhone(browser, path, top) {
  const page = await browser.newPage({ viewport: PHONE, deviceScaleFactor: 2 })
  await page.setContent(
    `<style>html,body{margin:0}img{width:${PHONE.width}px;display:block}</style><img src="${dataUri(path, 'image/png')}">`,
  )
  await page.locator('img').evaluate((img) => img.decode())
  await page.evaluate((y) => window.scrollTo(0, y), top)
  const png = await page.screenshot()
  await page.close()
  return `data:image/png;base64,${png.toString('base64')}`
}

/** Three phones in a row with rounded corners and a hairline border, on a
 *  transparent background so the strip sits on either GitHub theme. */
async function composeHero(browser, dir, theme, estimateTop) {
  const phones = []
  for (const [key, top] of heroScreens(estimateTop)) {
    phones.push(await cropPhone(browser, join(dir, theme, 'mobile', `${key}.png`), top))
  }
  // GitHub's own border colours, light and dark.
  const border = theme === 'light' ? '#d0d7de' : '#3d444d'
  const page = await browser.newPage({ viewport: { width: 1260, height: 900 } })
  await page.setContent(`<style>
    html,body{margin:0;background:transparent}
    .row{display:flex;gap:30px;padding:14px 15px}
    img{width:${PHONE.width}px;height:${PHONE.height}px;border-radius:28px;border:1px solid ${border};display:block}
  </style><div class="row">${phones.map((src) => `<img src="${src}">`).join('')}</div>`)
  for (const img of await page.locator('img').all()) await img.evaluate((el) => el.decode())
  const path = join(dir, `hero-${theme}.png`)
  await page.locator('.row').screenshot({ path, omitBackground: true })
  await page.close()
  return path
}

/** Wordmark D (frontend/src/components/shell/Wordmark.tsx) at 1.5x its
 *  'large' size: the name, the twelve-segment gauge with the plan tick, and
 *  the serving line. Its colours come from loading theme.css itself with the
 *  theme set on <html>, exactly as the app does, so a palette change reaches
 *  the README without anyone copying hex values across. */
async function renderWordmark(browser, dir, theme) {
  const font = join(REPO, 'frontend/node_modules/@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2')
  const tokens = readFileSync(join(REPO, 'frontend/src/theme.css'), 'utf8')
  const page = await browser.newPage({ viewport: { width: 800, height: 300 }, deviceScaleFactor: 2 })
  await page.setContent(`<html data-theme="${theme}"><style>
    ${tokens}
    @font-face{font-family:"Libre Franklin";src:url(${dataUri(font, 'font/woff2')}) format("woff2");font-weight:100 900}
    html,body{margin:0;background:transparent}
    .wm{display:inline-grid;font-family:"Libre Franklin";color:var(--ink);padding:6px 8px}
    .name{font-size:60px;line-height:1;font-weight:900;letter-spacing:-0.035em}
    .gauge{margin:7px 0 4px;display:grid;height:12px;grid-template-columns:repeat(12,1fr) 4px;gap:3px}
    .gauge i{background:var(--ink)}
    .gauge i.off{background:color-mix(in srgb,var(--ink) 20%,transparent)}
    .gauge i.plan{background:var(--plan)}
    .serving{display:flex;justify-content:space-between;gap:16px;border-top:1.5px solid var(--ink);padding-top:2px;font-size:19.5px}
    .serving b{font-weight:800}
  </style><div class="wm"><span class="name">Trackaholic</span>
  <span class="gauge">${Array.from({ length: 12 }, (_, i) => `<i class="${i < 9 ? '' : 'off'}"></i>`).join('')}<i class="plan"></i></span>
  <span class="serving"><span>Serving size</span><b>1 habit</b></span></div></html>`)
  await page.evaluate(() => document.fonts.ready)
  const path = join(dir, `wordmark-${theme}.png`)
  await page.locator('.wm').screenshot({ path, omitBackground: true })
  await page.close()
  return path
}

/** Both images in both themes. `estimateTop` is keyed by theme. Returns the
 *  paths written. */
export async function writeReadmeImages(browser, dir, estimateTop) {
  const paths = []
  for (const theme of THEMES) {
    if (!Number.isFinite(estimateTop[theme])) throw new Error(`no estimate position for ${theme}`)
    paths.push(await renderWordmark(browser, dir, theme))
    paths.push(await composeHero(browser, dir, theme, estimateTop[theme]))
  }
  return paths
}

// ---------------------------------------------------------------------------
// Standalone

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir, flag, value] = process.argv.slice(2)
  const top = Number(value)
  if (!dir || flag !== '--estimate-top' || !Number.isFinite(top)) {
    console.error('usage: node scripts/readme-images.mjs <screenshots-dir> --estimate-top <css px>')
    process.exit(2)
  }
  const chromium = await loadChromium()
  const browser = await chromium.launch({ executablePath: findExecutable() })
  for (const path of await writeReadmeImages(browser, dir, { light: top, dark: top })) console.log(`  ${path}`)
  await browser.close()
}

