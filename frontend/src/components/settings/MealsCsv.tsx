import { useRef, useState } from 'react'
import { api } from '../../api/client'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import type { ImportResult } from '../../types'

/** The meals as a CSV file, out and back in. Moved here from Analytics when
 *  Progress replaced it; phase 3 gives it its final home, You -> Your data.
 *  Styled like the JSON download beside it until then. */
export default function MealsCsv() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  useLiveMessage(error)
  const said = result ? importSummary(result) : ''
  useLiveMessage(said)
  const fileInput = useRef<HTMLInputElement>(null)

  const exportCsv = async () => {
    setError('')
    setExporting(true)
    try {
      await api.downloadExport()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const importCsv = async (file: File) => {
    setImporting(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.importCsv(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const button =
    'rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-60'

  return (
    <div className="mt-5 border-t border-slate-800 pt-4">
      <p className="mb-2 text-sm text-slate-400">
        Your meals as a spreadsheet file, to keep a copy or to bring meals in from elsewhere. Columns: date, name,
        calories, protein, and optionally carbs and fat. Importing skips meals that are already here.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={exportCsv} disabled={exporting} className={button}>
          {exporting ? 'Exporting…' : 'Export meals (CSV)'}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={importing} className={button}>
          {importing ? 'Importing…' : 'Import meals (CSV)'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])}
        />
      </div>
      {result && <p className="mt-2 text-sm text-emerald-400">{said}</p>}
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  )
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "Imported 1 meal. Skipped 2 duplicates and 0 invalid rows." */
function importSummary(result: ImportResult): string {
  return (
    `Imported ${count(result.inserted, 'meal', 'meals')}. ` +
    `Skipped ${count(result.skipped_duplicates, 'duplicate', 'duplicates')} and ` +
    `${count(result.skipped_invalid, 'invalid row', 'invalid rows')}.`
  )
}
