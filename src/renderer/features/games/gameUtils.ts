export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Seconds → "M:SS". */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/** Zero-pad a score for that retro arcade look. */
export function formatScore(score: number): string {
  return Math.floor(score).toString().padStart(5, '0')
}

/**
 * Size a canvas to its CSS box at device-pixel resolution and return the 2D
 * context pre-scaled so all drawing can use logical (CSS) pixels.
 */
export function fitCanvas(canvas: HTMLCanvasElement): {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
} {
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}
