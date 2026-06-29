import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { app, dialog } from 'electron'
import type { GameAsset, GameAssetKey, GameAssets } from '@shared/types'
import type { SettingsRepository } from '../database/repositories/settingsRepository'
import { readImageSize } from './imageSize'

const CONFIG_KEY = 'game.assets'
const ALLOWED = new Set(['.png', '.gif', '.webp', '.jpg', '.jpeg'])
const EXTENSIONS = ['png', 'gif', 'webp', 'jpg', 'jpeg']

/** URL served by the shared `sprite://` protocol registered in the main process. */
function assetUrl(fileName: string): string {
  return `sprite://s/${encodeURIComponent(fileName)}`
}

/**
 * Stores user-supplied artwork for the mini-games (bread, obstacles, platform).
 * Files share the sprite directory + `sprite://` protocol with `SpriteService`;
 * the per-slot mapping lives in settings. Each asset may be a single picture or a
 * horizontal strip animated via `frames`/`fps`.
 */
export class GameAssetService {
  private readonly dir = join(app.getPath('userData'), 'sprites')

  constructor(private readonly settings: SettingsRepository) {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
  }

  getAssets(): GameAssets {
    const stored = this.settings.get(CONFIG_KEY)
    if (!stored) return {}
    try {
      const parsed = JSON.parse(stored) as GameAssets
      // Always re-derive URLs from file names so saves survive scheme changes.
      for (const key of Object.keys(parsed) as GameAssetKey[]) {
        const asset = parsed[key]
        if (asset) asset.fileUrl = assetUrl(asset.fileName)
      }
      return parsed
    } catch {
      return {}
    }
  }

  async upload(key: GameAssetKey): Promise<GameAssets> {
    const src = await this.pick(`Choose artwork for "${key}"`)
    if (!src) return this.getAssets()

    const assets = this.getAssets()
    const previous = assets[key]?.fileName
    const dest = this.copyIn(src, key)
    const size = readImageSize(dest)
    assets[key] = {
      fileName: basename(dest),
      fileUrl: assetUrl(basename(dest)),
      size: statSync(dest).size,
      imageWidth: size?.width ?? 0,
      imageHeight: size?.height ?? 0,
      frames: 1,
      fps: 8
    }
    this.save(assets)
    if (previous && previous !== assets[key]!.fileName) this.removeFileIfUnused(previous)
    return this.getAssets()
  }

  set(key: GameAssetKey, opts: Pick<GameAsset, 'frames' | 'fps'>): GameAssets {
    const assets = this.getAssets()
    const asset = assets[key]
    if (asset) {
      asset.frames = Math.max(1, Math.round(opts.frames))
      asset.fps = Math.min(60, Math.max(1, Math.round(opts.fps)))
      this.save(assets)
    }
    return this.getAssets()
  }

  clear(key: GameAssetKey): GameAssets {
    const assets = this.getAssets()
    const removed = assets[key]?.fileName
    delete assets[key]
    this.save(assets)
    if (removed) this.removeFileIfUnused(removed)
    return this.getAssets()
  }

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

  private copyIn(src: string, key: GameAssetKey): string {
    const label = `game-${key.replace(/\./g, '-')}`
    const dest = this.uniqueDest(`${label}${extname(src).toLowerCase()}`)
    copyFileSync(src, dest)
    return dest
  }

  private save(assets: GameAssets): void {
    this.settings.set(CONFIG_KEY, JSON.stringify(assets))
  }

  /** Delete a file unless another game-asset slot still references it. */
  private removeFileIfUnused(fileName: string): void {
    const assets = this.getAssets()
    const stillUsed = (Object.keys(assets) as GameAssetKey[]).some(
      (key) => assets[key]?.fileName === fileName
    )
    if (stillUsed) return
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
