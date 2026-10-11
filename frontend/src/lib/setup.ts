import type { ActivityLevel, Settings, Sex, TargetPreviewRequest } from '../types.ts'
import type { TrackerKey } from './trackers.ts'
import { KG_PER_LB, ftInToCm, type WeightUnit } from './units.ts'

// Setup (/setup): the questions that turn a new account into a target, and
// the checks on each answer. Pure, so it can be tested without a browser.
// The server re-checks everything (schemas.TargetPreviewRequest); these
// exist so a typo is caught on the question it was made on, in plain words,
// before the next screen.

/** The seven questions of "Work it out for me", in order, as they appear in
 *  the address (?q=height), so the phone's back gesture steps back one. */
export const QUESTIONS = ['weight', 'height', 'birth', 'sex', 'activity', 'goal', 'extras'] as const
export type Question = (typeof QUESTIONS)[number]

/** Every screen of setup: the method choice, the seven questions, the
 *  target they give, and "I have my own numbers". */
export type SetupScreen = 'start' | Question | 'target' | 'own'

export function screenFrom(param: string | null): SetupScreen {
  const known: readonly string[] = ['start', ...QUESTIONS, 'target', 'own']
  return param && known.includes(param) ? (param as SetupScreen) : 'start'
}

export type Goal = 'lose' | 'maintain' | 'gain'

/** Everything setup asks, as typed. Text stays text until it is used, so a
 *  half-typed "80." is kept as the person left it. */
export interface Answers {
  unit: WeightUnit
  weight: string
  heightCm: string
  feet: string
  inches: string
  birthDate: string
  sex: Sex | null
  activity: ActivityLevel | null
  goal: Goal
  /** A chip's weekly pace in the display unit, 'max' (as fast as it plans),
   *  or 'own' (typed in `ownPace`). */
  pace: string | null
  ownPace: string
  focus: 'muscle' | 'scale' | null
  goalWeight: string
  carbsAndFat: boolean
  trackers: TrackerKey[]
  remind: boolean
  remindAt: string
  // "I have my own numbers"
  ownCalories: string
  ownProtein: string
  ownCarbs: string
  ownFat: string
}

/** lb and ft/in where the phone's region uses them (the United States,
 *  Liberia and Myanmar), kg and cm everywhere else. */
export function regionUnit(language: string): WeightUnit {
  return /-(US|LR|MM)$/i.test(language) ? 'lb' : 'kg'
}

export function emptyAnswers(unit: WeightUnit): Answers {
  return {
    unit,
    weight: '',
    heightCm: '',
    feet: '',
    inches: '',
    birthDate: '',
    sex: null,
    activity: null,
    goal: 'lose',
    pace: null,
    ownPace: '',
    focus: null,
    goalWeight: '',
    carbsAndFat: false,
    trackers: [],
    remind: false,
    remindAt: '07:30',
    ownCalories: '',
    ownProtein: '',
    ownCarbs: '',
    ownFat: '',
  }
}

/** A typed number, or null when it is empty or not a number. A comma works
 *  as a decimal point, as people type it in most of Europe. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

const toKg = (value: number, unit: WeightUnit) => (unit === 'lb' ? value * KG_PER_LB : value)

export function weightKg(a: Answers): number | null {
  const value = parseNumber(a.weight)
  return value === null || value <= 0 ? null : toKg(value, a.unit)
}

export function heightCm(a: Answers): number | null {
  if (a.unit === 'lb') {
    const feet = parseNumber(a.feet)
    if (feet === null || feet <= 0) return null
    const inches = parseNumber(a.inches) ?? 0
    return inches < 0 ? null : ftInToCm(feet, inches)
  }
  const cm = parseNumber(a.heightCm)
  return cm === null || cm <= 0 ? null : cm
}

export function bmi(a: Answers): number | null {
  const w = weightKg(a)
  const h = heightCm(a)
  return w === null || h === null ? null : w / (h / 100) ** 2
}

// The server's bounds (schemas.py MIN_SETUP_WEIGHT_KG, MAX_WEIGHT_KG,
// MIN_SETUP_HEIGHT_CM, MAX_HEIGHT_CM, SETUP_BMI_RANGE, MAX_AGE_YEARS,
// MAX_INPUT_GOAL_RATE_KG_PER_WEEK). Mirrored, so change both together.
export const SETUP_LIMITS = {
  minWeightKg: 25,
  maxWeightKg: 635,
  minHeightCm: 100,
  maxHeightCm: 272,
  minBmi: 12,
  maxBmi: 100,
  maxAgeYears: 122,
  maxPaceKg: 5,
} as const

/** Typo checks only, on setup's own screen; not limits on what people may
 *  eat. The server has no such cap. */
export const OWN_LIMITS = { maxCalories: 10000, maxProtein: 500 } as const

/** Below this BMI no loss is planned (WHO: underweight). The server refuses
 *  the same (calculations.UNDERWEIGHT_BMI). */
export const UNDERWEIGHT_BMI = 18.5

export function weightProblem(a: Answers): string | null {
  if (a.weight.trim() === '') return null
  const w = weightKg(a)
  if (w === null) return `Type your weight as a number, like ${a.unit === 'lb' ? '177' : '80.4'}.`
  if (w < SETUP_LIMITS.minWeightKg || w > SETUP_LIMITS.maxWeightKg) {
    return `That doesn’t look right for a weight in ${a.unit}. Check for a typo.`
  }
  return null
}

export function heightProblem(a: Answers): string | null {
  const empty = a.unit === 'lb' ? a.feet.trim() === '' : a.heightCm.trim() === ''
  if (empty) return null
  const h = heightCm(a)
  if (h === null) return a.unit === 'lb' ? 'Type feet and inches, like 5 and 10.' : 'Type your height in cm, like 178.'
  if (h < SETUP_LIMITS.minHeightCm || h > SETUP_LIMITS.maxHeightCm) {
    const range = a.unit === 'lb' ? '3 ft 4 in and 8 ft 11 in' : '100 and 272 cm'
    return `Height has to be between ${range}. Check for a typo.`
  }
  const b = bmi(a)
  if (b !== null && (b < SETUP_LIMITS.minBmi || b > SETUP_LIMITS.maxBmi)) {
    const other = a.unit === 'kg' ? 'lb and ft' : 'kg and cm'
    return `With your weight that would be a BMI of ${Math.round(b)}, which can’t be right. Check the units: did you mean ${other}?`
  }
  return null
}

/** Today as YYYY-MM-DD, passed in so the checks are testable. */
export function birthProblem(a: Answers, today: string): string | null {
  if (a.birthDate === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.birthDate)) return 'Pick a date.'
  if (a.birthDate > today) return 'That date is in the future.'
  const oldest = `${Number(today.slice(0, 4)) - SETUP_LIMITS.maxAgeYears}${today.slice(4)}`
  if (a.birthDate < oldest) return `That would make you over ${SETUP_LIMITS.maxAgeYears}. Check the year.`
  return null
}

export const PACE_CHIPS: Record<WeightUnit, { value: string; label: string }[]> = {
  kg: [
    { value: '0.25', label: 'Gently · 0.25 kg' },
    { value: '0.5', label: 'Steadily · 0.5 kg' },
    { value: '0.75', label: 'Faster · 0.75 kg' },
  ],
  lb: [
    { value: '0.5', label: 'Gently · 0.5 lb' },
    { value: '1', label: 'Steadily · 1 lb' },
    { value: '1.5', label: 'Faster · 1.5 lb' },
  ],
}

/** The pace asked for, in kg a week, signed (negative to lose), or null if
 *  not answered yet. `maxKg` is the fastest the server plans in this
 *  direction, from the preview; 'max' needs it. */
export function paceKg(a: Answers, maxKg: number | null): number | null {
  if (a.goal === 'maintain') return 0
  const sign = a.goal === 'lose' ? -1 : 1
  if (a.pace === 'max') return maxKg === null ? null : sign * maxKg
  const text = a.pace === 'own' ? a.ownPace : a.pace
  if (text === null) return null
  const value = parseNumber(text)
  return value === null || value <= 0 ? null : sign * toKg(value, a.unit)
}

export function paceProblem(a: Answers): string | null {
  if (a.goal === 'maintain' || a.pace !== 'own' || a.ownPace.trim() === '') return null
  const value = parseNumber(a.ownPace)
  if (value === null || value <= 0) return `Type a pace above zero, like ${a.unit === 'lb' ? '1' : '0.5'}.`
  if (toKg(value, a.unit) > SETUP_LIMITS.maxPaceKg) {
    return 'That looks like a goal weight. Pace is how much to change each week; goal weight is under A few extras.'
  }
  return null
}

/** A weekly pace in the person's unit: "0.8 kg", "1.8 lb". */
export function paceText(kg: number, unit: WeightUnit): string {
  const shown = unit === 'lb' ? Math.round((Math.abs(kg) / KG_PER_LB) * 10) / 10 : Math.round(Math.abs(kg) * 100) / 100
  return `${shown} ${unit}`
}

/** Why the fastest pace it plans is what it is, in the words the server's
 *  reasons use (calculations.target_calories), worked out from the limits
 *  the preview returns: the fastest loss and gain and the floor. */
export function fastestReason(
  goal: Goal,
  weightKgNow: number,
  max: { loss: number; gain: number; floorKcal: number },
): string {
  if (goal === 'gain') {
    if (max.gain > 0.005 * weightKgNow + 0.001) return 'an extra 500 kcal a day is the most it plans below a healthy weight'
    return max.gain < 1 ? 'half a percent of your body weight a week is the most it plans' : '1 kg a week is the most it plans'
  }
  const byWeight = Math.min(0.01 * weightKgNow, 1)
  if (max.loss < byWeight - 0.001) {
    return `any faster would take you below ${Math.round(max.floorKcal).toLocaleString('en-GB')} kcal a day, the lowest target it sets for you`
  }
  return 0.01 * weightKgNow < 1 ? '1% of your body weight a week is the most it plans' : '1 kg a week is the most it plans'
}

/** Lose is not offered below a healthy BMI. */
export function lossRefused(a: Answers): boolean {
  const b = bmi(a)
  return b !== null && b < UNDERWEIGHT_BMI
}

export type Remark = { kind: 'ask' | 'warn'; text: string }

/** A goal weight that contradicts the goal is asked about (Next waits); one
 *  under a healthy BMI is only remarked on. Empty is fine: it is optional. */
export function goalWeightRemark(a: Answers): Remark | null {
  if (a.goalWeight.trim() === '') return null
  const typed = parseNumber(a.goalWeight)
  if (typed === null || typed <= 0) return { kind: 'ask', text: 'Type a goal weight as a number, or leave it empty.' }
  const goalKg = toKg(typed, a.unit)
  if (goalKg < SETUP_LIMITS.minWeightKg || goalKg > SETUP_LIMITS.maxWeightKg) {
    return { kind: 'ask', text: `That doesn’t look like a weight in ${a.unit}. Check for a typo.` }
  }
  const now = weightKg(a)
  if (now !== null && a.goal === 'lose' && goalKg >= now) {
    return { kind: 'ask', text: `${typed} ${a.unit} is above your weight today, and you chose Lose. Change it, or go back to Your goal.` }
  }
  if (now !== null && a.goal === 'gain' && goalKg <= now) {
    return { kind: 'ask', text: `${typed} ${a.unit} is below your weight today, and you chose Gain. Change it, or go back to Your goal.` }
  }
  const h = heightCm(a)
  if (h !== null && goalKg / (h / 100) ** 2 < UNDERWEIGHT_BMI) {
    const floor = UNDERWEIGHT_BMI * (h / 100) ** 2
    const shown = a.unit === 'lb' ? floor / KG_PER_LB : floor
    return {
      kind: 'warn',
      text: `That’s under a healthy BMI for your height (about ${shown.toFixed(1)} ${a.unit}). It’s saved either way.`,
    }
  }
  return null
}

/** Whether a question has an answer good enough to move on from. */
export function answered(q: Question, a: Answers, today: string, maxKg: number | null): boolean {
  switch (q) {
    case 'weight':
      return weightKg(a) !== null && weightProblem(a) === null
    case 'height':
      return heightCm(a) !== null && heightProblem(a) === null
    case 'birth':
      return a.birthDate !== '' && birthProblem(a, today) === null
    case 'sex':
      return a.sex !== null
    case 'activity':
      return a.activity !== null
    case 'goal':
      if (a.goal === 'lose' && lossRefused(a)) return false
      return paceKg(a, maxKg) !== null && paceProblem(a) === null
    case 'extras':
      return goalWeightRemark(a)?.kind !== 'ask'
  }
}

/** The preview request, or null until every answer it needs is in. */
export function previewRequest(a: Answers, maxKg: number | null): TargetPreviewRequest | null {
  const w = weightKg(a)
  const h = heightCm(a)
  if (w === null || h === null || !a.birthDate || !a.sex || !a.activity) return null
  // Without a pace yet, ask about maintaining: the answer still carries the
  // fastest loss and gain, which the pace question needs to show.
  const rate = paceKg(a, maxKg) ?? 0
  return {
    weight_kg: Math.round(w * 1000) / 1000,
    height_cm: h,
    birth_date: a.birthDate,
    sex: a.sex,
    activity_level: a.activity,
    goal_rate_kg_per_week: Math.round(rate * 1000) / 1000,
    protein_focus: a.focus,
  }
}

/** The goal weight in kg, or null when left empty. */
export function goalWeightKg(a: Answers): number | null {
  if (a.goal === 'maintain') return null
  const typed = parseNumber(a.goalWeight)
  return typed === null || typed <= 0 ? null : Math.round(toKg(typed, a.unit) * 1000) / 1000
}

/** What "Use this target" stores, over the settings already there. The
 *  weigh-in is saved first and separately (POST /api/weights); this PUT then
 *  turns automatic targets on, and the server writes the goals from the
 *  profile in the same transaction, so no invented number is ever shown in
 *  between. */
export function autoSettings(base: Settings, a: Answers, rateKg: number): Settings {
  return {
    ...base,
    weight_unit: a.unit,
    height_cm: heightCm(a),
    birth_date: a.birthDate,
    sex: a.sex,
    activity_level: a.activity,
    goal_rate_kg_per_week: Math.round(rateKg * 1000) / 1000,
    goal_weight_kg: goalWeightKg(a),
    protein_focus: a.focus,
    track_carbs: a.carbsAndFat,
    track_fat: a.carbsAndFat,
    trackers: a.trackers,
    weigh_in_reminder_time: a.remind ? a.remindAt : null,
    targets_auto: true,
    target_set: true,
  }
}

/** Carbs and fat that fit the typed calories with the typed protein: fat a
 *  quarter of the calories (as the automatic targets do), carbs the rest.
 *  A starting point the person can change. */
export function splitRest(calories: number, protein: number): { carbs: number; fat: number } {
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { carbs, fat }
}

/** 4 kcal a gram for protein and carbs, 9 for fat; 10 kcal of slack, as the
 *  server allows (settings._refuse_goals_that_cannot_add_up). */
export function ownNumbersProblem(a: Answers): string | null {
  const kcal = parseNumber(a.ownCalories)
  const protein = parseNumber(a.ownProtein)
  if (a.ownCalories.trim() !== '' && (kcal === null || kcal <= 0)) return 'Type calories as a number above zero.'
  if (kcal !== null && kcal > OWN_LIMITS.maxCalories) return 'Over 10,000 kcal a day looks like a typo.'
  if (a.ownProtein.trim() !== '' && (protein === null || protein <= 0)) return 'Type protein as a number above zero.'
  if (protein !== null && protein > OWN_LIMITS.maxProtein) return 'Over 500 g of protein a day looks like a typo.'
  if (kcal === null || protein === null) return null
  const carbs = a.carbsAndFat ? (parseNumber(a.ownCarbs) ?? 0) : 0
  const fat = a.carbsAndFat ? (parseNumber(a.ownFat) ?? 0) : 0
  const needed = protein * 4 + carbs * 4 + fat * 9
  if (needed > kcal + 10) {
    const what = a.carbsAndFat ? 'Your protein, carbs and fat come to' : `${protein} g of protein is`
    return `${what} ${Math.round(needed).toLocaleString('en-GB')} kcal, more than ${Math.round(kcal).toLocaleString('en-GB')}. Lower one, or raise the calories.`
  }
  return null
}

/** Under the convention's lowest daily target, only remarked on. */
export function ownNumbersRemark(a: Answers): string | null {
  const kcal = parseNumber(a.ownCalories)
  return kcal !== null && kcal > 0 && kcal < 1200
    ? 'Under 1,200 kcal a day is usually done with a doctor’s knowledge. It’s saved either way.'
    : null
}

export function ownReady(a: Answers): boolean {
  const kcal = parseNumber(a.ownCalories)
  const protein = parseNumber(a.ownProtein)
  if (kcal === null || protein === null || kcal <= 0 || protein <= 0) return false
  if (a.carbsAndFat && (parseNumber(a.ownCarbs) === null || parseNumber(a.ownFat) === null)) return false
  return ownNumbersProblem(a) === null
}

/** What "Use these numbers" stores: the typed goals, automatic targets off. */
export function ownSettings(base: Settings, a: Answers): Settings {
  const kcal = parseNumber(a.ownCalories) ?? base.calorie_goal
  const protein = parseNumber(a.ownProtein) ?? base.protein_goal
  return {
    ...base,
    weight_unit: a.unit,
    calorie_goal: kcal,
    protein_goal: protein,
    carbs_goal: a.carbsAndFat ? (parseNumber(a.ownCarbs) ?? base.carbs_goal) : base.carbs_goal,
    fat_goal: a.carbsAndFat ? (parseNumber(a.ownFat) ?? base.fat_goal) : base.fat_goal,
    track_carbs: a.carbsAndFat,
    track_fat: a.carbsAndFat,
    trackers: a.trackers,
    weigh_in_reminder_time: a.remind ? a.remindAt : null,
    targets_auto: false,
    // Typed goals equal to the signup defaults would not count as a change,
    // so the choice is stated outright.
    target_set: true,
  }
}
