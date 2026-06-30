import { useEffect, useRef, useState } from 'react'
import type { SpriteClip } from '@shared/types'

/** Default on-screen height for any sprite, so different sheets render consistently. */
const DISPLAY_HEIGHT = 180

/**
 * Plays a sprite-sheet clip on a <canvas>, extracting exactly one frame per draw
 * via `drawImage(src, sx, sy, fw, fh, …)`. Unlike the old `background-position`
 * approach, this never bleeds neighbouring frames on fractional-DPI displays
 * (the cause of the jittery/"inaccurate" animation on Windows at 125%/150%
 * scaling) because the source rectangle is pixel-exact and the canvas backing
 * store is sized in device pixels with nearest-neighbour scaling.
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [ready, setReady] = useState(false)

  const scale = height / Math.max(1, clip.frameHeight)
  const dispW = Math.max(1, Math.round(clip.frameWidth * scale))
  const dispH = Math.max(1, Math.round(clip.frameHeight * scale))
  const cols = Math.max(1, clip.columns)

  // Load (and cache) the sheet image whenever the source file changes.
  useEffect(() => {
    setReady(false)
    imgRef.current = null
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setReady(true)
    }
    img.src = clip.fileUrl
    return () => {
      img.onload = null
    }
  }, [clip.fileUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !ready) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(dispW * dpr))
    canvas.height = Math.max(1, Math.round(dispH * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false

    const frames = Math.max(1, clip.frameCount)
    const start = Math.max(0, clip.startFrame ?? 0)
    const frameMs = 1000 / Math.max(1, clip.fps)
    let frame = 0
    let last = performance.now()
    let raf = 0

    const draw = (): void => {
      const idx = start + (frame % frames)
      const sx = (idx % cols) * clip.frameWidth
      const sy = Math.floor(idx / cols) * clip.frameHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        img,
        sx,
        sy,
        clip.frameWidth,
        clip.frameHeight,
        0,
        0,
        canvas.width,
        canvas.height
      )
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
  }, [clip, cols, dispW, dispH, ready])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: dispW,
        height: dispH,
        transform: flip ? 'scaleX(-1)' : undefined,
        imageRendering: 'pixelated'
      }}
    />
  )
}
