import { useEffect, useRef, useState } from 'react'
import type { GameAssetKey, GameAssets } from '@shared/types'
import { ipc } from '../../lib/ipc'

export interface LoadedAsset {
  img: HTMLImageElement
  frames: number
  fps: number
}

export type LoadedAssets = Partial<Record<GameAssetKey, LoadedAsset>>

/**
 * Loads the user's custom game artwork and keeps it live (re-fetches on the
 * `EvtGameAssets` broadcast). Returns ready-to-draw `HTMLImageElement`s; games
 * check `img.complete` and fall back to their default look until an image loads.
 */
export function useGameAssets(): LoadedAssets {
  const [loaded, setLoaded] = useState<LoadedAssets>({})
  const cache = useRef<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    let alive = true
    const apply = (assets: GameAssets): void => {
      const next: LoadedAssets = {}
      for (const key of Object.keys(assets) as GameAssetKey[]) {
        const a = assets[key]
        if (!a) continue
        let img = cache.current.get(a.fileUrl)
        if (!img) {
          img = new Image()
          img.src = a.fileUrl
          // Re-render once it loads so the first frame swaps in promptly.
          img.onload = () => alive && setLoaded((prev) => ({ ...prev }))
          cache.current.set(a.fileUrl, img)
        }
        next[key] = { img, frames: Math.max(1, a.frames || 1), fps: Math.max(1, a.fps || 8) }
      }
      if (alive) setLoaded(next)
    }

    void ipc.invoke(ipc.channels.GameAssetsGet).then(apply).catch(() => {})
    const off = ipc.on(ipc.channels.EvtGameAssets, apply)
    return () => {
      alive = false
      off()
    }
  }, [])

  return loaded
}

/** Returns the underlying image only once it's actually painted-ready. */
export function readyImage(asset: LoadedAsset | undefined): HTMLImageElement | null {
  return asset && asset.img.complete && asset.img.naturalWidth > 0 ? asset.img : null
}

/** Current animation frame index for a strip asset, given the clock. */
export function frameIndex(asset: LoadedAsset, now: number): number {
  if (asset.frames <= 1) return 0
  return Math.floor((now / 1000) * asset.fps) % asset.frames
}
