// Picks the colour theme before the first paint.
//
// Loaded from index.html's <head> as a plain (non-module) script, so it runs
// while the page is still being parsed, before anything is drawn. It sets the
// three attributes theme.css switches on (data-theme, data-palette,
// data-style) from the choice stored on this device. Done any later -- in
// React, say -- a dark-phone user would see one frame of light first.
//
// A file rather than an inline <script> because the Content-Security-Policy
// is script-src 'self', which blocks inline scripts.
//
// Kept in step with src/lib/appearance.ts, which the app uses for the same
// choice once it is running; tests/themeInit.test.ts checks the two agree.
// Anything it does not recognise falls back to the default, so a stored value
// from an older version (the palette "mono", removed in 3b) still loads.
;(function () {
  var THEMES = ['auto', 'light', 'dark']
  var PALETTES = ['daylight', 'ocean', 'teal', 'citrus', 'violet', 'berry', 'clay', 'sand', 'ember']
  var STYLES = ['fields', 'label']

  var saved = null
  try {
    saved = JSON.parse(localStorage.getItem('trackaholic_appearance'))
  } catch (e) {
    // Storage blocked, or not JSON: the defaults it is.
  }
  if (!saved || typeof saved !== 'object') saved = {}

  function pick(allowed, value) {
    return allowed.indexOf(value) >= 0 ? value : allowed[0]
  }

  var theme = pick(THEMES, saved.theme)
  if (theme === 'auto') {
    var dark = false
    try {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch (e) {
      // No matchMedia: light.
    }
    theme = dark ? 'dark' : 'light'
  }
  var palette = pick(PALETTES, saved.palette)
  var style = pick(STYLES, saved.style)

  var root = document.documentElement
  root.setAttribute('data-theme', theme)
  if (palette !== 'daylight') root.setAttribute('data-palette', palette)
  if (style !== 'fields') root.setAttribute('data-style', style)
})()
