import { useEffect, useRef } from 'react'
import type { SpriteClip } from '@shared/types'

/** Default on-screen height for any sprite, so different sheets render consistently. */
const DISPLAY_HEIGHT = 180

/**
 * Plays a sprite-sheet clip by stepping `backgroundPosition` across the sheet's
 * rows × columns at the clip's fps. The whole sheet is scaled via
 * `background-size` so each frame renders at a consistent height without
 * overflowing its layout box, and flips horizontally to face right.
 *
 * `height` lets callers (e.g. the mini-games) render the same animation at a
 * different size while keeping the exact stepping logic the duck uses.
 */
export function SpriteDuck({
  clip,
  flip,
  height = DISPLAY_HEIGHT
}: {
  clip: SpriteClip
  flip: boolean
  height?: number
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  const scale = height / Math.max(1, clip.frameHeight)
  const cols = Math.max(1, clip.columns)
  const rows = Math.max(1, clip.rows)
  const dispW = clip.frameWidth * scale
  const dispH = clip.frameHeight * scale

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const frames = Math.max(1, clip.frameCount)
    const start = Math.max(0, clip.startFrame ?? 0)
    const frameMs = 1000 / Math.max(1, clip.fps)
    let frame = 0
    let last = performance.now()
    let raf = 0

    const draw = (): void => {
      const idx = start + (frame % frames)
      const col = idx % cols
      const row = Math.floor(idx / cols)
      el.style.backgroundPosition = `-${col * dispW}px -${row * dispH}px`
    }
    draw()

    const loop = (t: number): void => {
      if (t - last >= frameMs) {
        last = t
        frame = (frame + 1) % frames
        draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [clip, cols, dispW, dispH])

  return (
    <div style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <div
        ref={ref}
        style={{
          width: dispW,
          height: dispH,
          backgroundImage: `url("${clip.fileUrl}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${cols * dispW}px ${rows * dispH}px`,
          imageRendering: 'pixelated'
        }}
      />
    </div>
  )
}
