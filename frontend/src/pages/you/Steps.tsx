import { useRef, useState } from 'react'
import { api } from '../../api/client'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import type { ImportResult } from '../../types'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import Explainer from '@/ui/explainer'
import { SettingNumber } from '@/ui/number-field'

const count = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`

/** "Imported 212 days. Kept 3 you already had; 1 row couldn't be read." */
function importSummary(result: ImportResult): string {
  let text = `Imported ${count(result.inserted, 'day', 'days')}.`
  if (result.skipped_duplicates > 0) text += ` Kept ${count(result.skipped_duplicates, 'day', 'days')} you already had.`
  if (result.skipped_invalid > 0) text += ` ${count(result.skipped_invalid, 'row', 'rows')} couldn’t be read.`
  return text
}

/** Steps, pushed from You: an optional goal, and the way in for a history.
 *
 *  The goal is a single optional box rather than water's pair of chips,
 *  because the states differ: water always shows *a* goal, so the choice is
 *  only where it comes from. Steps has no derivation at all, so the choice is
 *  whether a goal exists, and an empty box says that well. There is no
 *  default on purpose: 10,000 is a slogan from a 1960s pedometer advert, not a
 *  number worked out from anything about you.
 *
 *  The import writes straight to the server, so it is outside the draft and
 *  never raises the Save bar. Its result stays on screen under the button,
 *  not in a toast, because a toast is gone in five seconds. */
export default function StepsScreen() {
  return (
    <SettingsScreen title="Steps">
      <Steps />
    </SettingsScreen>
  )
}

function Steps() {
  const { settings, update, guard } = useSettingsScreen()
  const fileInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  useLiveMessage(result)
  useLiveMessage(error)

  const importFile = async (file: File) => {
    setImporting(true)
    setError('')
    setResult('')
    try {
      setResult(importSummary(await api.importStepsCsv(file)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed. Try again.')
    } finally {
      setImporting(false)
      // Cleared so picking the same file again fires onChange again.
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <Block label="Daily goal">
        <SettingNumber
          id="steps-goal"
          label="Steps a day (optional)"
          inputMode="numeric"
          placeholder="No goal"
          value={settings.steps_goal}
          onValue={(value) => update({ steps_goal: value })}
          onBlur={guard('steps_goal')}
        />
        <p className="text-small text-ink-2">
          Steps don’t change your calorie target. Your measured burn already counts them.
        </p>
      </Block>

      <Block label="Step history">
        <p className="text-small text-ink-2">Bring in past days from a phone export.</p>
        <div>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import a CSV file'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])}
          />
        </div>
        {result && <p className="text-small">{result}</p>}
        {error && <p className="border-l-2 border-ink pl-3 text-small">{error}</p>}
        <Explainer label="What files work?">
          A CSV with a date column and a steps column, one row per day. Samsung Health’s export works as it comes; for
          other apps, pick out those two columns first. Days you already have are kept. There’s no live sync: Health
          Connect and Apple Health only open to apps from a store.
        </Explainer>
      </Block>
    </>
  )
}
