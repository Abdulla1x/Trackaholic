// Run with `npm test` (see photoSize.test.ts for how).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saveFile, type SaveEnv } from '../src/lib/saveFile.ts'

const FILE = new File(['date,name\n'], 'macros_backup.csv', { type: 'text/csv' })

/** A browser to order: where it runs, whether it shares, and what it did. */
function env(overrides: Partial<SaveEnv> & { shareFails?: string } = {}) {
  const calls = { shared: 0, downloaded: [] as string[] }
  const { shareFails, ...rest } = overrides
  const fake: SaveEnv = {
    installed: true,
    touch: true,
    canShare: () => true,
    share: async () => {
      calls.shared += 1
      if (shareFails) throw new DOMException('refused', shareFails)
    },
    download: (file) => void calls.downloaded.push(file.name),
    ...rest,
  }
  return { fake, calls }
}

test('an installed app on a phone hands the file to the share sheet', async () => {
  const { fake, calls } = env()
  assert.equal(await saveFile(FILE, fake), 'shared')
  assert.deepEqual(calls, { shared: 1, downloaded: [] })
})

test('a browser tab, or a desktop, downloads it', async () => {
  for (const where of [{ installed: false }, { touch: false }]) {
    const { fake, calls } = env(where)
    assert.equal(await saveFile(FILE, fake), 'downloaded')
    assert.deepEqual(calls, { shared: 0, downloaded: ['macros_backup.csv'] })
  }
})

test('a phone that cannot share files downloads it', async () => {
  for (const missing of [{ canShare: () => false }, { share: undefined }, { canShare: undefined }]) {
    const { fake, calls } = env(missing)
    assert.equal(await saveFile(FILE, fake), 'downloaded')
    assert.deepEqual(calls.downloaded, ['macros_backup.csv'])
  }
})

test('closing the share sheet is an answer, not a reason to download', async () => {
  const { fake, calls } = env({ shareFails: 'AbortError' })
  assert.equal(await saveFile(FILE, fake), 'cancelled')
  assert.deepEqual(calls.downloaded, [])
})

test('a share refused for a stale tap asks for another tap', async () => {
  const { fake, calls } = env({ shareFails: 'NotAllowedError' })
  assert.equal(await saveFile(FILE, fake), 'needs-tap')
  assert.deepEqual(calls.downloaded, [])
})

test('any other share failure falls back to the download', async () => {
  const { fake, calls } = env({ shareFails: 'DataError' })
  assert.equal(await saveFile(FILE, fake), 'downloaded')
  assert.deepEqual(calls, { shared: 1, downloaded: ['macros_backup.csv'] })
})
