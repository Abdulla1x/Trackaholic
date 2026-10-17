import { api } from '../api/client'

/** Downloading an export: the server signs a one-minute link and the browser
 *  follows it, so the file arrives the way any download from a website does.
 *
 *  It used to be fetched into the page and handed over from there, by a link
 *  with a `download` name or, in an installed app, to the share sheet. In the
 *  app installed from Huawei Browser on a P40 neither did anything: the
 *  phone's downloader needs a real address, and a file made in the page has
 *  none. The server sends both exports as attachments, so following the link
 *  starts the download and leaves this page where it is. */
export async function downloadExport(kind: 'meals' | 'all') {
  window.location.assign(await api.exportLink(kind))
}
