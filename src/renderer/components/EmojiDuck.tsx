import { useEffect, useRef, useState } from 'react'
import { selectDisplayState, useDuckStore } from '../stores/duckStore'
import { useSpriteSetup } from '../hooks/useSpriteSetup'
import { emojiFor } from '../animations/emojiMap'

/**
 * Emoji-based duck used until real sprite-sheet animations are uploaded.
 * Renders a large duck emoji with a per-state CSS motion plus an optional prop
 * (coffee, laptop, z's…), flips to face its travel direction, and shows a brief
 * action label when the state changes.
 */
export function EmojiDuck(): JSX.Element {
  const displayState = useDuckStore(selectDisplayState)
  const facing = useDuckStore((s) => s.facing)
  const baseImage = useSpriteSetup().baseImage
  const behavior = emojiFor(displayState)
  const [showLabel, setShowLabel] = useState(false)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setShowLabel(true)
    const timer = setTimeout(() => setShowLabel(false), 1600)
    return () => clearTimeout(timer)
  }, [displayState])

  // The 🦆 glyph faces left by default; flip it when walking right.
  const flip = facing === 'right'

  return (
    <div className="relative flex flex-col items-center">
      {/* Soft ground shadow so the duck reads clearly on any wallpaper. */}
      <div className="relative" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
        {behavior.prop && !baseImage && (
          <span className="absolute -right-5 -top-3 text-2xl motion-bob" aria-hidden>
            {behavior.prop}
          </span>
        )}
        {baseImage ? (
          <img
            src={baseImage.fileUrl}
            alt={`Duck ${behavior.label}`}
            draggable={false}
            className={`duck-emoji block h-20 w-20 select-none object-contain motion-${behavior.motion}`}
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <span
            className={`duck-emoji block text-7xl motion-${behavior.motion}`}
            role="img"
            aria-label={`Duck ${behavior.label}`}
          >
            {behavior.emoji}
          </span>
        )}
      </div>
      <div className="mt-0.5 h-2 w-14 rounded-[50%] bg-black/30 blur-sm" />
      {showLabel && (
        <div className="mt-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
          {behavior.label}
        </div>
      )}
    </div>
  )
}
