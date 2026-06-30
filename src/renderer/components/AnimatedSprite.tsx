import { useEffect, useRef, useState } from 'react'

/**
 * Plays a sprite sheet inside a fixed-size box (for settings previews). Steps
 * through `frameCount` frames starting at `startFrame`, computing each frame's
 * cell from the sheet's `columns`, and renders on a <canvas> via `drawImage`
 * with an exact source rect. This keeps the preview crisp and correctly sized
 * on every platform — including Windows fractional-DPI displays where the old
 * CSS `background-position` approach bled neighbouring frames and looked blurry.
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [ready, setReady] = useState(false)

  // Fit a single frame inside the box while preserving aspect ratio.
  const fit = Math.min(box / Math.max(1, frameWidth), box / Math.max(1, frameHeight))
  const dispW = Math.max(1, Math.round(frameWidth * fit))
  const dispH = Math.max(1, Math.round(frameHeight * fit))

  useEffect(() => {
    setReady(false)
    imgRef.current = null
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setReady(true)
    }
    img.src = fileUrl
    return () => {
      img.onload = null
    }
  }, [fileUrl])

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

    const cols = Math.max(1, columns)
    const frames = Math.max(1, frameCount)
    const start = Math.max(0, startFrame)
    const frameMs = 1000 / Math.max(1, fps)
    let frame = 0
    let last = performance.now()
    let raf = 0

    const draw = (): void => {
      const idx = start + (frame % frames)
      const sx = (idx % cols) * frameWidth
      const sy = Math.floor(idx / cols) * frameHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, sx, sy, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height)
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
  }, [fileUrl, frameWidth, frameHeight, columns, frameCount, fps, startFrame, dispW, dispH, playing, ready])

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/20"
      style={{ width: box, height: box }}
    >
      <canvas ref={canvasRef} style={{ width: dispW, height: dispH, imageRendering: 'pixelated' }} />
    </div>
  )
}
