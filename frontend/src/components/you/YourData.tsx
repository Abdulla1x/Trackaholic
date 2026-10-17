import { useRef, useState } from 'react'
import { api } from '../../api/client'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { downloadExport } from '../../lib/downloadExport'
import type { ImportResult } from '../../types'
import { RowButton } from '@/ui/row'

type Job = 'export' | 'import' | 'all'

const count = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`

/** "Imported 12 meals. 2 were already here. 1 row couldn't be read." A meal
 *  counts as already here when its date, name and every number match one you
 *  have, so importing the same file twice adds nothing. */
function importSummary(result: ImportResult): string {
  let text = result.inserted > 0 ? `Imported ${count(result.inserted, 'meal', 'meals')}.` : 'No new meals.'
  if (result.skipped_duplicates > 0) text += ` ${count(result.skipped_duplicates, 'was', 'were')} already here.`
  if (result.skipped_invalid > 0) text += ` ${count(result.skipped_invalid, 'row', 'rows')} couldn't be read.`
  return text
}

const DETAIL: Record<Job, string> = {
  export: 'A CSV file of every meal',
  import: 'From a CSV file',
  all: 'Everything, as one JSON file',
}

const BUSY: Record<Job, string> = {
  export: 'Exporting…',
  import: 'Importing…',
  all: 'Preparing the file…',
}

/** The "Your data" rows on You: the meals out and back in as a spreadsheet
 *  file, and everything as one JSON file. Each acts the moment it is tapped,
 *  so there is no chevron and no screen behind it.
 *
 *  What happened is written into the row's own detail line and stays there
 *  while you are on the page. A toast would be gone in five seconds, and an
 *  import's counts are the thing you came to read. */
export default function YourData() {
  const [busy, setBusy] = useState<Job | null>(null)
  const [said, setSaid] = useState<Partial<Record<Job, string>>>({})
  const [latest, setLatest] = useState('')
  useLiveMessage(latest)
  const fileInput = useRef<HTMLInputElement>(null)
  const run = async (job: Job, work: () => Promise<string | undefined>) => {
    setBusy(job)
    setSaid((now) => ({ ...now, [job]: undefined }))
    try {
      const text = await work()
      if (text) {
        setSaid((now) => ({ ...now, [job]: text }))
        setLatest(text)
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "That didn't work. Try again."
      setSaid((now) => ({ ...now, [job]: text }))
      setLatest(text)
    } finally {
      setBusy(null)
    }
  }

  // The browser takes the file from here, and shows the download itself.
  const exportFile = (job: Job, kind: 'meals' | 'all') =>
    run(job, async () => {
      await downloadExport(kind)
      return 'Handed to your browser to download.'
    })

  const importFile = (file: File) =>
    run('import', async () => {
      try {
        return importSummary(await api.importCsv(file))
      } finally {
        // Cleared so picking the same file again fires onChange again.
        if (fileInput.current) fileInput.current.value = ''
      }
    })

  const detail = (job: Job) => (busy === job ? BUSY[job] : (said[job] ?? DETAIL[job]))

  return (
    <>
      <RowButton
        label="Export meals"
        detail={detail('export')}
        disabled={busy !== null}
        onClick={() => exportFile('export', 'meals')}
      />
      <RowButton
        label="Import meals"
        detail={detail('import')}
        disabled={busy !== null}
        onClick={() => fileInput.current?.click()}
      />
      <RowButton
        label="Download all my data"
        detail={detail('all')}
        disabled={busy !== null}
        onClick={() => exportFile('all', 'all')}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])}
      />
    </>
  )
}
