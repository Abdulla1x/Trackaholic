import { shortDate } from './dates'

// The colours and shapes every chart in this app shares.
//
// The colours are the palette tokens by reference, not hex copies: the tokens
// change with the palette and with light and dark, so a frozen copy would draw
// every palette's charts in one palette's colours. Recharts passes these
// through as SVG presentation attributes and inline styles, and var() resolves
// in both in every browser the app supports.
//
// Data is ink; a goal or target is the plan colour, dashed, so it reads as a
// target before colour is even considered (DESIGN.md: the Plan Rule).

/** The default plot box. Negative `left` claws back the gutter recharts
 *  reserves for a y-axis label none of these charts has. */
export const chartMargin = { top: 5, right: 5, bottom: 0, left: -20 }

/** Rounded top corners only -- a bar sits on the axis, so its bottom corners
 *  are not corners. */
export const barRadius: [number, number, number, number] = [4, 4, 0, 0]

/** An axis date as "Sep 28" (lib/dates.ts). Recharts calls a tick formatter
 *  with (value, index), and the index must not reach shortDate's `now`. */
export const axisDate = (value: string) => shortDate(value)

/** The subject: the trend line, a day's bar. */
export const chartInk = 'var(--ink)'
/** Context: the raw weigh-ins under the trend, axis text. */
export const chartInk2 = 'var(--ink-2)'
/** Hairlines: the grid. */
export const chartRule = 'var(--rule)'
/** Targets and goals only (the Plan Rule). */
export const chartPlan = 'var(--plan)'
/** The page's own ground, used to ring an active dot so it reads as raised. */
export const chartGround = 'var(--ground)'

/** The dash every target line uses. */
export const planDash = '6 4'

/** Axis labels, in the body face at the small size. */
export const chartTick = { fill: chartInk2, fontSize: 12 }

/** The tap-to-read panel: the page's ground with a rule border, like a field. */
export const chartTooltip = {
  background: chartGround,
  border: `1.5px solid ${chartRule}`,
  borderRadius: 5,
  color: 'var(--ink)',
  fontSize: 13,
}
export const chartTooltipLabel = { color: chartInk2, marginBottom: 2 }

/** No negative left margin: Progress's y-axes size themselves to their
 *  labels (`width="auto"`), so the labels start at the chart's own edge. A
 *  margin that pushed them past it only looked right while nothing clipped
 *  them; Label's boxed sections do, and its wider font lost the first digit
 *  of "2,800". */
export const progressMargin = { top: 8, right: 4, bottom: 0, left: 0 }

/** The dot that appears under the cursor, ringed in the ground colour so it
 *  reads as raised rather than as an extra data point. */
export const activeDot = (fill: string) => ({
  r: 5,
  fill,
  stroke: chartGround,
  strokeWidth: 2,
})

/** Legend text, in secondary ink. */
export const legendStyle = { fontSize: 12, color: chartInk2 }

/** Admin's series, namespaced so a name cannot be borrowed by an unrelated
 *  chart and then moved with it. Signups and active accounts share a chart, so
 *  they differ in mark as well as tone: signups are bars in secondary ink,
 *  active accounts a line in ink. Meals have a chart of their own. */
export const adminHues = {
  active: chartInk,
  signups: chartInk2,
  meals: chartInk,
} as const
