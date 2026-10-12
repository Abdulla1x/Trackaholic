import type { PaletteId } from './appearance.ts'

/** The colours a palette swatch on You → Appearance is drawn with: each
 *  palette in light and in dark, so the swatches show the theme on screen.
 *
 *  A copy of theme.css, because a swatch has to show a palette other than the
 *  one in use, and the tokens only exist on <html> for the current one.
 *  tests/themeTokens.test.ts checks every value here against theme.css, the
 *  same way chartTheme mirrors the tokens it needs. Daylight's band is its
 *  ground: Daylight keeps the calories on the page. */
export interface Swatch {
  ground: string
  rule: string
  band: string
  bandInk: string
  action: string
  plan: string
}

export const SWATCHES: Record<PaletteId, { light: Swatch; dark: Swatch }> = {
  daylight: {
    light: { ground: '#e4e7e1', rule: '#c3c9c1', band: '#e4e7e1', bandInk: '#0f1210', action: '#1747e0', plan: '#8c1d8c' },
    dark: { ground: '#0b0e0c', rule: '#283029', band: '#0b0e0c', bandInk: '#e7ebe4', action: '#7d9bff', plan: '#e88ae8' },
  },
  ocean: {
    light: { ground: '#dce5ee', rule: '#b5c4d2', band: '#0e2a47', bandInk: '#f2f6fa', action: '#0b57c4', plan: '#7a4300' },
    dark: { ground: '#06101a', rule: '#1b2b3b', band: '#0f2d4d', bandInk: '#f2f6fa', action: '#6fa8ff', plan: '#ffb24a' },
  },
  teal: {
    light: { ground: '#dde9e6', rule: '#b5cbc6', band: '#0d3b3a', bandInk: '#eef8f6', action: '#0b6b62', plan: '#a8431f' },
    dark: { ground: '#071413', rule: '#1a2f2c', band: '#0e3634', bandInk: '#eef8f6', action: '#4fd1c1', plan: '#ff9e7a' },
  },
  citrus: {
    light: { ground: '#f3f3ee', rule: '#d6d7cd', band: '#24561f', bandInk: '#f6fbf2', action: '#c2410c', plan: '#2f7d32' },
    dark: { ground: '#0f110c', rule: '#2a2e23', band: '#1f4a1b', bandInk: '#f6fbf2', action: '#ff9a4d', plan: '#8fd88a' },
  },
  violet: {
    light: { ground: '#e6e2ee', rule: '#c9c1d8', band: '#2a1a5e', bandInk: '#f4f0ff', action: '#5b2fc9', plan: '#9a4508' },
    dark: { ground: '#0d0a17', rule: '#2a2440', band: '#2b1b60', bandInk: '#f4f0ff', action: '#a98bff', plan: '#ffb067' },
  },
  berry: {
    light: { ground: '#ecdfe7', rule: '#d1bbca', band: '#3a1430', bandInk: '#fbeef6', action: '#8c1a5a', plan: '#0d6a64' },
    dark: { ground: '#120a10', rule: '#2e1d29', band: '#3d1633', bandInk: '#fbeef6', action: '#ff8fc8', plan: '#7fe0d6' },
  },
  clay: {
    light: { ground: '#ece3dc', rule: '#d2c2b6', band: '#63301f', bandInk: '#fbeee6', action: '#a33c12', plan: '#1f5f78' },
    dark: { ground: '#140d0a', rule: '#33241d', band: '#4a2216', bandInk: '#fbeee6', action: '#ff8a5c', plan: '#8fd0e6' },
  },
  sand: {
    light: { ground: '#eae1d2', rule: '#cdc1ae', band: '#2b2420', bandInk: '#f5ede1', action: '#12595e', plan: '#8a2d5a' },
    dark: { ground: '#14110d', rule: '#2e281f', band: '#2e2621', bandInk: '#f5ede1', action: '#5cc6c9', plan: '#f2a6cb' },
  },
  ember: {
    light: { ground: '#e3e5e8', rule: '#c5c9cf', band: '#131416', bandInk: '#f3f4f6', action: '#b3121b', plan: '#b3121b' },
    dark: { ground: '#0b0c0e', rule: '#2a2d32', band: '#1b1d21', bandInk: '#f3f4f6', action: '#ff4d55', plan: '#ff4d55' },
  },
}
