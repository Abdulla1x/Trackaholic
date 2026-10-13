// Carbs and fat around a protein, while calories stay worked out: the
// server's rule (calculations.macro_targets), mirrored so Daily targets can
// show the split live while protein is typed. The server's numbers win once
// saved. The mirror starts from the worked-out protein in whole grams, so in
// a rare case it can differ from the saved split by a gram.
//
// Protein above the worked-out amount comes out of fat first, down to its
// minimum, before carbs lose anything; below it, carbs gain. Past the point
// where carbs would go below zero even with fat at its minimum, protein
// doesn't fit.

// The same constants as calculations.py (FAT_FRACTION_OF_CALORIES,
// MIN_FAT_G_PER_KG, Atwater). Sources are beside them there.
const FAT_FRACTION = 0.25
const MIN_FAT_G_PER_KG = 0.5
const KCAL_PROTEIN = 4
const KCAL_CARB = 4
const KCAL_FAT = 9

export type FatState = 'quarter' | 'less' | 'minimum'

export interface ProteinSplit {
  protein: number
  carbs: number
  fat: number
  /** Where fat sits: its quarter of calories, below it to make room for
   *  protein, or at its minimum. */
  fatState: FatState
  fits: boolean
  /** The most protein that fits these calories (calculations.max_protein_g). */
  maxProtein: number
}

export function proteinSplit(
  calories: number,
  referenceKg: number,
  workedOutProtein: number,
  protein: number,
): ProteinSplit {
  const minFat = MIN_FAT_G_PER_KG * referenceKg
  const normalFat = Math.max((FAT_FRACTION * calories) / KCAL_FAT, minFat)
  const extra = Math.max(0, protein - workedOutProtein) * KCAL_PROTEIN
  let fat = Math.max(minFat, normalFat - extra / KCAL_FAT)
  const carbsLeft = (f: number) => (calories - protein * KCAL_PROTEIN - f * KCAL_FAT) / KCAL_CARB
  let carbs = carbsLeft(fat)
  if (carbs < 0) {
    fat = minFat
    carbs = carbsLeft(fat)
  }
  const fatState: FatState = fat <= minFat + 1e-6 ? 'minimum' : fat < normalFat - 1e-6 ? 'less' : 'quarter'
  return {
    protein: Math.round(protein),
    carbs: Math.round(Math.max(carbs, 0)),
    fat: Math.round(fat),
    fatState,
    fits: carbs > -1e-6,
    maxProtein: Math.floor((calories - minFat * KCAL_FAT) / KCAL_PROTEIN),
  }
}
