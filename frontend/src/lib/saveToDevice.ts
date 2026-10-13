import { saveFile, type SaveEnv, type SaveResult } from './saveFile'

/** lib/saveFile.ts with this page's own browser plugged in: what the export
 *  buttons call. */
export function saveToDevice(file: File): Promise<SaveResult> {
  return saveFile(file, browserEnv())
}

/** How long a downloaded file's address is kept alive. Revoking it straight
 *  after the click, as this used to, can cancel a download that the browser
 *  starts a moment later. */
const REVOKE_AFTER_MS = 60_000

/** The page's own browser. Read when a file is saved, not at load, because
 *  installing the app does not reload a page already open. */
function browserEnv(): SaveEnv {
  const matches = (query: string) => window.matchMedia?.(query).matches ?? false
  return {
    installed:
      matches('(display-mode: standalone)') ||
      matches('(display-mode: fullscreen)') ||
      matches('(display-mode: minimal-ui)'),
    touch: matches('(pointer: coarse)'),
    canShare: navigator.canShare?.bind(navigator),
    share: navigator.share?.bind(navigator),
    download: downloadFile,
  }
}

/** The link-with-a-download-name route. The link is put in the page for the
 *  click (some browsers ignore a click on one that is not), and the file's
 *  address lives on for a minute afterwards. */
function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}
