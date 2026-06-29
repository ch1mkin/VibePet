import type { DuckAnimationState } from './duck'

/**
 * Frame geometry describing how to slice a sprite sheet into animation frames.
 * Frames are read left-to-right, top-to-bottom across `rows` × `columns`.
 */
export interface SpriteGeometry {
  /** Width of a single frame, in source pixels. */
  frameWidth: number
  /** Height of a single frame, in source pixels. */
  frameHeight: number
  /** Number of rows of frames in the sheet. */
  rows: number
  /** Number of frames per row. */
  columns: number
  /** Total frames in the sheet (≤ rows × columns). */
  frameCount: number
  /** Playback speed in frames per second. */
  fps: number
}

interface SheetFile {
  /** File name on disk (unique within the sprite folder). */
  fileName: string
  /** URL the renderer can load (served via the `sprite://` protocol). */
  fileUrl: string
  /** Bytes, for display. */
  size: number
  /** Detected full image dimensions (0 when unknown). */
  imageWidth: number
  imageHeight: number
}

/**
 * A playable clip: a sheet + geometry + the frame window to play.
 * `startFrame` lets a clip play a sub-range of a larger sheet (method 2).
 */
export interface SpriteClip extends SpriteGeometry, SheetFile {
  /** First frame index to play (row-major). Defaults to 0. */
  startFrame?: number
}

/** A single master sheet the user slices into many animations (method 2). */
export interface SpriteAtlas extends SpriteGeometry, SheetFile {}

/** An inclusive frame range within the atlas, optionally with its own fps. */
export interface SpriteRange {
  from: number
  to: number
  fps?: number
}

/**
 * A single static image used in place of the 🦆 emoji everywhere the emoji
 * fallback is shown (desktop duck + in-game duck). It still animates via the
 * per-state CSS motion (idle bob, run, fly…), so a one-image duck gets life.
 */
export interface BaseImage {
  fileName: string
  fileUrl: string
}

/**
 * Full sprite configuration.
 *  - `clips`: per-action sheets (method 1 — upload one file per action).
 *  - `atlas` + `ranges`: one master sheet sliced into per-action frame ranges
 *    (method 2 — upload once, drag-select ranges, assign to actions).
 * A range assignment takes priority over a per-action clip for the same action.
 */
export interface SpriteSetup {
  clips: Partial<Record<DuckAnimationState, SpriteClip>>
  atlas: SpriteAtlas | null
  ranges: Partial<Record<DuckAnimationState, SpriteRange>>
  /** Optional custom image that replaces the emoji glyph (still CSS-animated). */
  baseImage: BaseImage | null
}

export const DEFAULT_FPS = 8

export function emptySpriteSetup(): SpriteSetup {
  return { clips: {}, atlas: null, ranges: {}, baseImage: null }
}
