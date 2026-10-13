/** Handing a file the app made (an export) to the phone or computer.
 *
 *  The usual way is a link with a `download` name pointing at the file, which
 *  is what every desktop browser expects. Installed as an app on a phone it
 *  can do nothing at all: in the app installed from Huawei Browser on a P40
 *  both exports did nothing, with no error and no download. So on a
 *  touch device running as an installed app, the file goes to the share sheet
 *  instead, where it can be saved to Files or sent on; anywhere else, and if
 *  sharing is unavailable or fails, it is downloaded.
 *
 *  A share must start soon after a tap, and an export first waits for the
 *  server, which on a cold start takes long enough for the browser to refuse.
 *  That comes back as 'needs-tap' rather than a silent failure: the caller
 *  keeps the file and asks for one more tap, which opens the sheet at once.
 *
 *  The browser is reached only through `SaveEnv`, so the choice is testable
 *  without one; lib/saveToDevice.ts plugs the real one in. */

export type SaveResult = 'downloaded' | 'shared' | 'cancelled' | 'needs-tap'

/** What the share sheet is given: the browser's ShareData, files only. */
export interface ShareFiles {
  files: File[]
}

export interface SaveEnv {
  /** Running as an installed app rather than in a browser tab. */
  installed: boolean
  /** A finger rather than a mouse: a phone or tablet. */
  touch: boolean
  canShare?: (data: ShareFiles) => boolean
  share?: (data: ShareFiles) => Promise<void>
  download: (file: File) => void
}

export async function saveFile(file: File, env: SaveEnv): Promise<SaveResult> {
  const data: ShareFiles = { files: [file] }
  if (env.installed && env.touch && env.share && env.canShare?.(data)) {
    try {
      await env.share(data)
      return 'shared'
    } catch (err) {
      const name = err instanceof Error || err instanceof DOMException ? err.name : ''
      // The sheet was closed without choosing anything: that is an answer.
      if (name === 'AbortError') return 'cancelled'
      // Too long since the tap: one more tap opens it.
      if (name === 'NotAllowedError') return 'needs-tap'
      // Anything else, try the ordinary download instead.
    }
  }
  env.download(file)
  return 'downloaded'
}
