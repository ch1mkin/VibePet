import type { DuckAnimationState, SpriteAtlas, SpriteClip, SpriteRange, SpriteSetup } from '../types'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Builds a playable clip from a master atlas slice (inclusive frame range). */
export function clipFromAtlas(atlas: SpriteAtlas, range: SpriteRange): SpriteClip {
  const total = Math.max(1, atlas.frameCount)
  const from = clamp(Math.round(range.from), 0, total - 1)
  const to = clamp(Math.round(range.to), from, total - 1)
  return {
    fileName: atlas.fileName,
    fileUrl: atlas.fileUrl,
    size: atlas.size,
    imageWidth: atlas.imageWidth,
    imageHeight: atlas.imageHeight,
    frameWidth: atlas.frameWidth,
    frameHeight: atlas.frameHeight,
    rows: atlas.rows,
    columns: atlas.columns,
    frameCount: to - from + 1,
    fps: range.fps && range.fps > 0 ? range.fps : atlas.fps,
    startFrame: from
  }
}

/**
 * Resolves the clip to play for a given action. A drag-selected atlas range
 * wins over a per-action file clip; otherwise falls back to the per-action clip.
 * Returns undefined when the action should use the emoji fallback.
 */
export function resolveSpriteClip(
  setup: SpriteSetup,
  state: DuckAnimationState
): SpriteClip | undefined {
  const range = setup.ranges?.[state]
  if (setup.atlas && range) return clipFromAtlas(setup.atlas, range)
  return setup.clips?.[state]
}
