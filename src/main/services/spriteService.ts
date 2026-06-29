import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { app, dialog } from 'electron'
import {
  DEFAULT_FPS,
  emptySpriteSetup,
  type DuckAnimationState,
  type SpriteAtlas,
  type SpriteClip,
  type SpriteGeometry,
  type SpriteRange,
  type SpriteSetup
} from '@shared/types'
import type { SettingsRepository } from '../database/repositories/settingsRepository'
import { readImageSize } from './imageSize'

const CONFIG_KEY = 'sprites.config'
const ALLOWED = new Set(['.png', '.gif', '.webp', '.jpg', '.jpeg'])
const EXTENSIONS = ['png', 'gif', 'webp', 'jpg', 'jpeg']

/** URL served by the custom `sprite://` protocol registered in the main process. */
function spriteUrl(fileName: string): string {
  return `sprite://s/${encodeURIComponent(fileName)}`
}

/**
 * Manages sprite sheets via two workflows that share one config:
 *  1. Per-action files: a separate sheet uploaded for each action (`clips`).
 *  2. Master atlas: one big sheet sliced into per-action frame ranges
 *     (`atlas` + `ranges`).
 * Files live in the app's sprite directory; the config is persisted in settings.
 */
export class SpriteService {
  private readonly dir = join(app.getPath('userData'), 'sprites')

  constructor(private readonly settings: SettingsRepository) {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
  }

  getSetup(): SpriteSetup {
    const stored = this.settings.get(CONFIG_KEY)
    if (!stored) return emptySpriteSetup()
    try {
      const parsed = JSON.parse(stored) as Partial<SpriteSetup> & Record<string, unknown>
      // Back-compat: an older save stored just the clips map at the top level.
      const setup: SpriteSetup =
        parsed.clips || parsed.atlas || parsed.ranges || parsed.baseImage
          ? {
              clips: parsed.clips ?? {},
              atlas: parsed.atlas ?? null,
              ranges: parsed.ranges ?? {},
              baseImage: parsed.baseImage ?? null
            }
          : { clips: parsed as SpriteSetup['clips'], atlas: null, ranges: {}, baseImage: null }
      // Always derive URLs from file names so saves survive any scheme change.
      for (const key of Object.keys(setup.clips) as DuckAnimationState[]) {
        const clip = setup.clips[key]
        if (clip) clip.fileUrl = spriteUrl(clip.fileName)
      }
      if (setup.atlas) setup.atlas.fileUrl = spriteUrl(setup.atlas.fileName)
      if (setup.baseImage) setup.baseImage.fileUrl = spriteUrl(setup.baseImage.fileName)
      return setup
    } catch {
      return emptySpriteSetup()
    }
  }

  // ── Method 1: per-action files ────────────────────────────────────────────

  async uploadClip(state: DuckAnimationState): Promise<SpriteSetup> {
    const src = await this.pick(`Choose a sprite sheet for "${state}"`)
    if (!src) return this.getSetup()

    const dest = this.copyIn(src, state)
    const size = readImageSize(dest)
    const setup = this.getSetup()
    this.removeFileIfUnused(setup, setup.clips[state]?.fileName, state)
    setup.clips[state] = this.makeClip(dest, size)
    this.save(setup)
    return setup
  }

  setClipGeometry(state: DuckAnimationState, geometry: SpriteGeometry): SpriteSetup {
    const setup = this.getSetup()
    const clip = setup.clips[state]
    if (clip) {
      setup.clips[state] = { ...clip, ...sanitize(geometry) }
      this.save(setup)
    }
    return setup
  }

  clearClip(state: DuckAnimationState): SpriteSetup {
    const setup = this.getSetup()
    const removed = setup.clips[state]
    delete setup.clips[state]
    this.save(setup)
    if (removed) this.removeFileIfUnused(this.getSetup(), removed.fileName, state)
    return setup
  }

  // ── Method 2: master atlas + ranges ─────────────────────────────────────────

  async uploadAtlas(): Promise<SpriteSetup> {
    const src = await this.pick('Choose a master sprite sheet')
    if (!src) return this.getSetup()

    const setup = this.getSetup()
    const previous = setup.atlas?.fileName
    const dest = this.copyIn(src, 'atlas')
    const size = readImageSize(dest)
    const base = this.makeClip(dest, size)
    const atlas: SpriteAtlas = {
      fileName: base.fileName,
      fileUrl: base.fileUrl,
      size: base.size,
      imageWidth: base.imageWidth,
      imageHeight: base.imageHeight,
      frameWidth: base.frameWidth,
      frameHeight: base.frameHeight,
      rows: base.rows,
      columns: base.columns,
      frameCount: base.frameCount,
      fps: base.fps
    }
    setup.atlas = atlas
    setup.ranges = {} // ranges from a previous atlas no longer apply
    this.save(setup)
    if (previous && previous !== atlas.fileName) this.removeFileIfUnused(this.getSetup(), previous)
    return setup
  }

  setAtlasGeometry(geometry: SpriteGeometry): SpriteSetup {
    const setup = this.getSetup()
    if (setup.atlas) {
      setup.atlas = { ...setup.atlas, ...sanitize(geometry) }
      this.save(setup)
    }
    return setup
  }

  clearAtlas(): SpriteSetup {
    const setup = this.getSetup()
    const removed = setup.atlas?.fileName
    setup.atlas = null
    setup.ranges = {}
    this.save(setup)
    if (removed) this.removeFileIfUnused(this.getSetup(), removed)
    return setup
  }

  setRange(state: DuckAnimationState, range: SpriteRange | null): SpriteSetup {
    const setup = this.getSetup()
    if (!range) {
      delete setup.ranges[state]
    } else {
      const from = Math.max(0, Math.round(range.from))
      const to = Math.max(from, Math.round(range.to))
      setup.ranges[state] = { from, to, ...(range.fps ? { fps: Math.round(range.fps) } : {}) }
    }
    this.save(setup)
    return setup
  }

  // ── Base image (replaces the emoji glyph) ───────────────────────────────────

  async uploadBaseImage(): Promise<SpriteSetup> {
    const src = await this.pick('Choose a duck image (replaces the emoji)')
    if (!src) return this.getSetup()

    const setup = this.getSetup()
    const previous = setup.baseImage?.fileName
    const dest = this.copyIn(src, 'base')
    const fileName = basename(dest)
    setup.baseImage = { fileName, fileUrl: spriteUrl(fileName) }
    this.save(setup)
    if (previous && previous !== fileName) this.removeFileIfUnused(this.getSetup(), previous)
    return setup
  }

  clearBaseImage(): SpriteSetup {
    const setup = this.getSetup()
    const removed = setup.baseImage?.fileName
    setup.baseImage = null
    this.save(setup)
    if (removed) this.removeFileIfUnused(this.getSetup(), removed)
    return setup
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async pick(title: string): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: EXTENSIONS }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    return ALLOWED.has(extname(src).toLowerCase()) ? src : null
  }

  private copyIn(src: string, label: string): string {
    const dest = this.uniqueDest(`${label}${extname(src).toLowerCase()}`)
    copyFileSync(src, dest)
    return dest
  }

  private makeClip(dest: string, size: { width: number; height: number } | null): SpriteClip {
    const imageWidth = size?.width ?? 0
    const imageHeight = size?.height ?? 0
    // Default guess: a single horizontal strip of square frames.
    const frameHeight = imageHeight || 64
    const frameWidth = frameHeight
    const columns = imageWidth && frameWidth ? Math.max(1, Math.round(imageWidth / frameWidth)) : 1
    return {
      fileName: basename(dest),
      fileUrl: spriteUrl(basename(dest)),
      size: statSync(dest).size,
      imageWidth,
      imageHeight,
      frameWidth,
      frameHeight,
      rows: 1,
      columns,
      frameCount: columns,
      fps: DEFAULT_FPS
    }
  }

  private save(setup: SpriteSetup): void {
    this.settings.set(CONFIG_KEY, JSON.stringify(setup))
  }

  /** Deletes a sheet file unless a clip/atlas still references it. */
  private removeFileIfUnused(
    setup: SpriteSetup,
    fileName: string | undefined,
    excludeClip?: DuckAnimationState
  ): void {
    if (!fileName) return
    const usedByClip = (Object.keys(setup.clips) as DuckAnimationState[]).some(
      (key) => key !== excludeClip && setup.clips[key]?.fileName === fileName
    )
    const usedByAtlas = setup.atlas?.fileName === fileName
    if (usedByClip || usedByAtlas) return
    const target = join(this.dir, basename(fileName))
    if (existsSync(target)) rmSync(target)
  }

  private uniqueDest(fileName: string): string {
    let dest = join(this.dir, fileName)
    if (!existsSync(dest)) return dest
    const ext = extname(fileName)
    const base = basename(fileName, ext)
    let i = 1
    do {
      dest = join(this.dir, `${base}-${i}${ext}`)
      i += 1
    } while (existsSync(dest))
    return dest
  }
}

function sanitize(g: SpriteGeometry): SpriteGeometry {
  const int = (v: number, min: number): number => Math.max(min, Math.round(Number.isFinite(v) ? v : min))
  return {
    frameWidth: int(g.frameWidth, 1),
    frameHeight: int(g.frameHeight, 1),
    rows: int(g.rows, 1),
    columns: int(g.columns, 1),
    frameCount: int(g.frameCount, 1),
    fps: Math.min(60, int(g.fps, 1))
  }
}
