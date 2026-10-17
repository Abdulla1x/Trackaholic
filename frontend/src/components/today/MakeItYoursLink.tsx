import { Link } from 'react-router-dom'
import { PALETTES } from '../../lib/appearance'
import { SWATCHES } from '../../lib/palettes'

// The first five palettes, each as its band colour; Daylight keeps its band
// on the ground, so it shows its action blue instead (as on the 3a prototype).
const DOTS = PALETTES.slice(0, 5).map(({ id }) => {
  const { ground, band, action } = SWATCHES[id].light
  return band === ground ? action : band
})

/** "Make it yours: pick a colour", with five palette dots, to You →
 *  Appearance. An invitation rather than a setup step: shown once setup is
 *  done (Getting started's last moment) and in the new-Trackaholic prompt. */
export default function MakeItYoursLink() {
  return (
    <Link
      to="/you/appearance"
      className="inline-flex min-h-8 items-center gap-2 justify-self-start font-semibold text-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
    >
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {DOTS.map((colour) => (
          <span key={colour} className="h-3.5 w-2 rounded-[1px]" style={{ background: colour }} />
        ))}
      </span>
      Make it yours: pick a colour
    </Link>
  )
}
