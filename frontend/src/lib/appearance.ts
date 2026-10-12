/** How the app looks on this device: Automatic, Light or Dark; one of nine
 *  palettes; and the Fields or Label style.
 *
 *  It belongs to the device, not the account (decided in 3b), so it lives in
 *  localStorage under one key and is NOT account-scoped: every account signed
 *  in on one phone shares it, the way they share the phone's own dark mode.
 *
 *  public/theme-init.js applies the same choice before the first paint, and
 *  cannot import this file, so the lists below are written out twice.
 *  tests/themeInit.test.ts checks the script and these functions agree, and
 *  that both name exactly the palettes theme.css defines. */

export const APPEARANCE_KEY = 'trackaholic_appearance'

export const THEMES = ['auto', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEMES)[number]

/** In display order, cool to warm (the 3b palette review). */
export const PALETTES = [
  { id: 'daylight', name: 'Daylight' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'teal', name: 'Teal' },
  { id: 'citrus', name: 'Citrus' },
  { id: 'violet', name: 'Violet' },
  { id: 'berry', name: 'Berry' },
  { id: 'clay', name: 'Clay' },
  { id: 'sand', name: 'Sand' },
  { id: 'ember', name: 'Ember' },
] as const
export type PaletteId = (typeof PALETTES)[number]['id']

export const STYLES = ['fields', 'label'] as const
export type StyleChoice = (typeof STYLES)[number]

export interface Appearance {
  theme: ThemeChoice
  palette: PaletteId
  style: StyleChoice
}

export const DEFAULT_APPEARANCE: Appearance = { theme: 'auto', palette: 'daylight', style: 'fields' }

const oneOf = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** The stored choice, with anything unrecognised (junk, a palette that has
 *  since been removed) replaced by its default rather than rejected whole. */
export function parseAppearance(raw: string | null): Appearance {
  let saved: unknown = null
  try {
    saved = raw === null ? null : JSON.parse(raw)
  } catch {
    /* Not JSON: the defaults. */
  }
  const s = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {}
  return {
    theme: oneOf(THEMES, s.theme, DEFAULT_APPEARANCE.theme),
    palette: oneOf(
      PALETTES.map((p) => p.id),
      s.palette,
      DEFAULT_APPEARANCE.palette,
    ),
    style: oneOf(STYLES, s.style, DEFAULT_APPEARANCE.style),
  }
}

/** Automatic follows the phone; the other two ignore it. */
export function resolveTheme(theme: ThemeChoice, phoneIsDark: boolean): 'light' | 'dark' {
  return theme === 'auto' ? (phoneIsDark ? 'dark' : 'light') : theme
}

export const paletteName = (id: PaletteId): string => PALETTES.find((p) => p.id === id)!.name
