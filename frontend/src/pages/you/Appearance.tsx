import { useAppearance } from '../../appearance/AppearanceContext'
import ScreenBar from '../../components/shell/ScreenBar'
import { PALETTES, type PaletteId, type StyleChoice, type ThemeChoice } from '../../lib/appearance'
import { SWATCHES } from '../../lib/palettes'
import { useSettings } from '../../settings/SettingsContext'
import { useInstantSave } from '../../settings/useInstantSave'
import { cn } from '@/lib/utils'
import Block from '@/ui/block'
import { Chip } from '@/ui/chip'
import { SwitchRow } from '@/ui/switch'
import Screen from '@/ui/screen'

const THEME_CHOICES: [ThemeChoice, string][] = [
  ['auto', 'Automatic'],
  ['light', 'Light'],
  ['dark', 'Dark'],
]

/** Appearance, from You: how the app looks. Theme, style and colour belong
 *  to this device and save the moment they are tapped, like every chip (no Save
 *  bar); "Show meal times" is an account setting and saves the same way.
 *
 *  Laid out as the 3a prototype's Appearance screen, signed off 12 Oct. The
 *  Colours grid is 3 by 3 rather than its 4 by 2: the palette review left
 *  nine. Meal times moved here from Goals: it changes what Today shows and is
 *  not a goal. */
export default function Appearance() {
  const { settings } = useSettings()
  const saveNow = useInstantSave()
  const { appearance, theme, setAppearance } = useAppearance()
  return (
    <Screen>
      <ScreenBar title="Appearance" back="/you" backLabel="Back to You" />

      <Block label="Theme">
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-1.5">
          {THEME_CHOICES.map(([value, name]) => (
            <Chip
              key={value}
              role="radio"
              pressed={appearance.theme === value}
              onClick={() => setAppearance({ theme: value })}
            >
              {name}
            </Chip>
          ))}
        </div>
        <p className="text-small text-ink-2">Automatic follows your phone.</p>
      </Block>

      <Block label="Style">
        <div role="radiogroup" aria-label="Style" className="grid grid-cols-2 gap-2.5">
          <StyleCard
            style="fields"
            name="Fields"
            detail="Big numbers, your colours"
            selected={appearance.style === 'fields'}
            onSelect={() => setAppearance({ style: 'fields' })}
          />
          <StyleCard
            style="label"
            name="Label"
            detail="Black and white, like the label on a pack"
            selected={appearance.style === 'label'}
            onSelect={() => setAppearance({ style: 'label' })}
          />
        </div>
      </Block>

      <Block label="Colours">
        <div role="radiogroup" aria-label="Colours" className="grid grid-cols-3 gap-2">
          {PALETTES.map(({ id, name }) => (
            <PaletteSwatch
              key={id}
              palette={id}
              name={name}
              dark={theme === 'dark'}
              selected={appearance.palette === id}
              disabled={appearance.style === 'label'}
              onSelect={() => setAppearance({ palette: id })}
            />
          ))}
        </div>
        <p className="text-small text-ink-2">
          {appearance.style === 'label'
            ? 'Colours apply to the Fields style. Label is always black and white.'
            : 'Each colour has a light and a dark version.'}{' '}
          Theme, style and colour are kept on this device, not your account.
        </p>
      </Block>

      {settings && (
        <Block label="Today">
          <SwitchRow
            label="Show meal times"
            detail="When each meal was logged, beside it on Today"
            checked={settings.show_meal_times}
            onCheckedChange={(on) => saveNow({ show_meal_times: on })}
          />
        </Block>
      )}
    </Screen>
  )
}

/** A style as a sample of itself, drawn in that style whichever one is on:
 *  Fields as a labelled big number, Label as a scrap of nutrition label. */
function StyleCard({
  style,
  name,
  detail,
  selected,
  onSelect,
}: {
  style: StyleChoice
  name: string
  detail: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'grid min-w-0 cursor-pointer content-start gap-2 rounded-control border-[1.5px] bg-field p-2.5 text-left text-ink',
        'transition-[border-color,box-shadow] duration-150 ease-out-expo',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action',
        selected ? 'border-ink inset-ring-[1.5px] inset-ring-ink' : 'border-rule hover:border-ink',
      )}
    >
      {style === 'fields' ? (
        <span aria-hidden="true" className="grid gap-0.5 font-sans">
          <span className="text-field-label text-ink-2">Kcal left</span>
          <span className="text-[26px] leading-[0.9] font-[820] [font-stretch:75%]">1,240</span>
        </span>
      ) : (
        <span aria-hidden="true" className="grid border-2 border-ink bg-label px-1.5 py-1 font-label">
          <span className="border-b-[5px] border-ink pb-0.5 text-[15px] font-black tracking-[-0.02em]">Today</span>
          <span className="flex justify-between pt-0.5 text-[11px] font-extrabold">
            <span>Calories</span>
            <span>860</span>
          </span>
        </span>
      )}
      <span className="grid gap-0.5">
        <span className="font-semibold">{name}</span>
        <span className="text-small text-ink-2">{detail}</span>
      </span>
    </button>
  )
}

/** One palette as a tiny Today: its calories band over its ground, with the
 *  action, plan and band-ink colours as three dashes. Drawn in the theme on
 *  screen now, so in dark mode every swatch shows its dark version. */
function PaletteSwatch({
  palette,
  name,
  dark,
  selected,
  disabled,
  onSelect,
}: {
  palette: PaletteId
  name: string
  dark: boolean
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const colours = SWATCHES[palette][dark ? 'dark' : 'light']
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'grid min-w-0 cursor-pointer gap-1.5 rounded-control border-[1.5px] bg-field p-1.5 text-left text-ink disabled:cursor-default disabled:opacity-45',
        'transition-[border-color,box-shadow] duration-150 ease-out-expo',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action',
        selected ? 'border-ink inset-ring-[1.5px] inset-ring-ink' : 'border-rule hover:border-ink',
      )}
    >
      <span
        aria-hidden="true"
        className="grid h-[38px] grid-rows-[1fr_10px] overflow-hidden rounded-[3px] border"
        style={{ background: colours.ground, borderColor: colours.rule }}
      >
        <span style={{ background: colours.band }} />
        <span className="flex items-center gap-[3px] px-1">
          <span className="h-1 w-2.5 rounded-[1px]" style={{ background: colours.action }} />
          <span className="h-1 w-2.5 rounded-[1px]" style={{ background: colours.plan }} />
          <span className="h-1 w-2.5 rounded-[1px] opacity-60" style={{ background: colours.bandInk }} />
        </span>
      </span>
      <span className="truncate text-[13px] font-semibold">{name}</span>
    </button>
  )
}
