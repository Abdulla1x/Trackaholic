import type { ActivityLevel } from '../types.ts'

// The five activity levels as people read them, shared by setup and
// You → Body so the same week never gets two descriptions. Each level's
// multiplier lives on the server (calculations.ACTIVITY_MULTIPLIERS, inside
// FAO/WHO/UNU's measured bands); this file only names them.
//
// Described in workouts a week and time on your feet, because that is how
// people know their own week. "Moderately active" read as faint praise for
// someone who trains four times a week, and they are "Active" here.

export interface ActivityOption {
  value: ActivityLevel
  name: string
  description: string
}

/** Least to most active: the order the multipliers rise in. */
export const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  {
    value: 'sedentary',
    name: 'Mostly sitting',
    description: 'Desk job or at home, little walking, no workouts',
  },
  {
    value: 'light',
    name: 'A little active',
    description: '1–2 workouts a week, or on your feet part of the day',
  },
  {
    value: 'moderate',
    name: 'Active',
    description: '3–5 workouts a week, or on your feet most of the day',
  },
  {
    value: 'active',
    name: 'Very active',
    description: '6–7 workouts a week, or a physical job',
  },
  {
    value: 'very_active',
    name: 'Extremely active',
    description: 'Training twice a day, or a physical job plus regular workouts',
  },
]

/** Asked with every list of levels: the app logs no exercise, so the level
 *  has to include it. */
export const ACTIVITY_QUESTION = 'How active is a typical week, exercise included?'

export const ACTIVITY_HINT =
  "A workout is any session where you're working hard: gym, running, sport."

/** One line for a dropdown: "Active: 3–5 workouts a week, …". */
export function activityLine({ name, description }: ActivityOption): string {
  return `${name}: ${description.charAt(0).toLowerCase()}${description.slice(1)}`
}

export function activityName(level: ActivityLevel): string {
  return ACTIVITY_OPTIONS.find((option) => option.value === level)?.name ?? level
}
