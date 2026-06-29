import { useEffect, useRef } from 'react'

/**
 * Plays a sprite sheet inside a fixed-size box (for previews). Steps through
 * `frameCount` frames starting at `startFrame`, computing each frame's cell from
 * the sheet's `columns`. Scales the frame to fit the box.
 */
export function AnimatedSprite({
  fileUrl,
  frameWidth,
  frameHeight,
  columns,
  frameCount,
  fps,
  startFrame = 0,
  box,
  playing = true
}: {
  fileUrl: string
  frameWidth: number
  frameHeight: number
  columns: number
  frameCount: number
  fps: number
  startFrame?: number
  box: number
  playing?: boolean
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cols = Math.max(1, columns)
    const frames = Math.max(1, frameCount)
    const start = Math.max(0, startFrame)
    const frameMs = 1000 / Math.max(1, fps)
    let frame = 0
    let last = performance.now()
    let raf = 0

    const draw = (): void => {
      const idx = start + (frame % frames)
      const col = idx % cols
      const row = Math.floor(idx / cols)
      el.style.backgroundPosition = `-${col * frameWidth}px -${row * frameHeight}px`
    }
    draw()

    if (!playing) return
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
  }, [fileUrl, frameWidth, frameHeight, columns, frameCount, fps, startFrame, playing])

  const scale = Math.min(box / Math.max(1, frameWidth), box / Math.max(1, frameHeight))
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/20"
      style={{ width: box, height: box }}
    >
      <div
        ref={ref}
        style={{
          width: frameWidth,
          height: frameHeight,
          backgroundImage: `url("${fileUrl}")`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          transform: `scale(${scale})`
        }}
      />
    </div>
  )
}
