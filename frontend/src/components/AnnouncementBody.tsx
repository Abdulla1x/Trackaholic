// Announcement bodies are written in a deliberately tiny subset of Markdown:
// blank-line paragraph breaks, **bold** and *italic*. That is everything the
// bodies in announcements.py use, and everything supported -- more would want a
// real parser, and a dependency for three constructs is a poor trade. If a note
// ever needs a list or a link, this is the place that has to learn them, and it
// will be obvious because they will appear on screen as punctuation.
//
// This matters more than it looks, and it shipped wrong. `item.body` used to go
// straight into a single <p>, where HTML collapses the blank lines: every note
// arrived as one unbroken wall of text, and three of them printed their **
// markers literally. Nothing in code review shows that -- the string is correct
// and the JSX is valid -- it is only visible on screen.
//
// It lives in its own file so the pop-up and the /whats-new page render a note
// identically by construction: both draw their notes with NoteList below. A
// claim that two views share a look is only true if they share a module.
import { parseIsoDate } from '../lib/dates'
import type { Announcement } from '../types'

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*)/g

function inline(text: string, key: string) {
  return text
    .split(INLINE)
    .filter((part) => part !== '')
    .map((part, index) => {
      const id = `${key}-${index}`
      // Bold is tested first because the alternation above prefers it, so a
      // `**word**` run never reaches the italic branch.
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={id} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        return <em key={id}>{part.slice(1, -1)}</em>
      }
      return <span key={id}>{part}</span>
    })
}

function AnnouncementBody({ text }: { text: string }) {
  return (
    <div className="mt-1 grid gap-2 text-small text-ink-2">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index}>{inline(paragraph, String(index))}</p>
      ))}
    </div>
  )
}

/** Release notes as rows between hairlines (DESIGN.md: Blocks and rows): the
 *  title, its date at the right, then the body. `heading` keeps the outline
 *  in order: h2 under a page's title, h3 under a sheet's. */
export function NoteList({ items, heading: Heading }: { items: Announcement[]; heading: 'h2' | 'h3' }) {
  return (
    <ul className="divide-y divide-rule">
      {items.map((item) => (
        <li key={item.id} className="py-3 first:pt-0">
          <div className="flex items-baseline justify-between gap-3">
            <Heading className="font-semibold">{item.title}</Heading>
            <time dateTime={item.date} className="shrink-0 text-small text-ink-2">
              {parseIsoDate(item.date).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </time>
          </div>
          <AnnouncementBody text={item.body} />
        </li>
      ))}
    </ul>
  )
}
