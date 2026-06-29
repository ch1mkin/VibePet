import { resolveSpriteClip } from '@shared/utils'
import { selectDisplayState, useDuckStore } from '../stores/duckStore'
import { useSpriteSetup } from '../hooks/useSpriteSetup'
import { EmojiDuck } from './EmojiDuck'
import { SpriteDuck } from './SpriteDuck'

/**
 * Renders the duck for the current state: a real sprite-sheet clip if one is
 * assigned (either a per-action file or a master-atlas range), otherwise the
 * emoji fallback.
 */
export function DuckAvatar(): JSX.Element {
  const displayState = useDuckStore(selectDisplayState)
  const facing = useDuckStore((s) => s.facing)
  const setup = useSpriteSetup()
  const clip = resolveSpriteClip(setup, displayState)

  if (!clip) return <EmojiDuck />

  return (
    <div className="relative flex flex-col items-center">
      <SpriteDuck clip={clip} flip={facing === 'right'} />
      {/* Pulled up so it tucks under the duck's feet (sprite frames have empty
          space at the bottom). Tune this if your sheet differs. */}
      <div
        className="h-2 w-14 rounded-[50%] bg-black/30 blur-sm"
        style={{ marginTop: -34 }}
      />
    </div>
  )
}
