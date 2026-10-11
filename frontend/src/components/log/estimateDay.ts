import { createContext, useContext } from 'react'

/** The day the AI estimate in play is for, or null when there is none.
 *
 *  An estimate runs in the background (AnalysisProvider) while the user moves
 *  around the app, and it has to land on the day it was started for. So every
 *  way of opening the Log panel while one is in play opens it on that day,
 *  whatever page it is opened from. AnalysisProvider provides this, and
 *  useLogPanel reads it. It is a context of its own because AnalysisProvider
 *  itself opens the panel through useLogPanel, so the two cannot import each
 *  other. */
export const EstimateDayContext = createContext<string | null>(null)

export function useEstimateDay(): string | null {
  return useContext(EstimateDayContext)
}
