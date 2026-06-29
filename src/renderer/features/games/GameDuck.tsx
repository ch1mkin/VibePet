import { resolveSpriteClip } from '@shared/utils'
import type { DuckAnimationState } from '@shared/types'
import { useSpriteSetup } from '../../hooks/useSpriteSetup'
import { emojiFor } from '../../animations/emojiMap'
import { SpriteDuck } from '../../components/SpriteDuck'

/**
 * The in-game duck rendered as a transparent DOM overlay (so the desktop shows
 * through behind the games). It uses the SAME sprite engine (`SpriteDuck`) and
 * the SAME resolved clip as the real desktop duck — just at a game-friendly
 * size — so animations behave identically. Falls back to the emoji animation
 * when no sheet is assigned for the state, exactly like the duck does.
 */
export function GameDuck({
  state,
  facing,
  size
}: {
  state: DuckAnimationState
  facing: 'left' | 'right'
  size: number
}): JSX.Element {
  const setup = useSpriteSetup()
  const clip = resolveSpriteClip(setup, state)

  if (clip) return <SpriteDuck clip={clip} flip={facing === 'right'} height={size} />

  const b = emojiFor(state)
  const baseImage = setup.baseImage
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size, transform: facing === 'right' ? 'scaleX(-1)' : undefined }}
    >
      {baseImage ? (
        <img
          src={baseImage.fileUrl}
          alt={`Duck ${b.label}`}
          draggable={false}
          className={`block h-full w-full select-none object-contain motion-${b.motion}`}
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span
          className={`duck-emoji block leading-none motion-${b.motion}`}
          style={{ fontSize: size * 0.84 }}
          role="img"
          aria-label={`Duck ${b.label}`}
        >
          {b.emoji}
        </span>
      )}
      {b.prop && !baseImage && (
        <span className="absolute right-0 top-0 motion-bob" style={{ fontSize: size * 0.32 }} aria-hidden>
          {b.prop}
        </span>
      )}
    </div>
  )
}
