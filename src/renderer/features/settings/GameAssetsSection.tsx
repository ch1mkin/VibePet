import { useEffect, useState } from 'react'
import { GAME_ASSETS, type GameAsset, type GameAssetKey, type GameAssets, type GameAssetMeta } from '@shared/types'
import { ipc } from '../../lib/ipc'

/**
 * Lets the user swap the artwork used by the mini-games (bread, obstacles, the
 * platform). Each slot accepts a single image, or a horizontal sprite strip that
 * animates via frames + fps. Empty slots fall back to the built-in look.
 */
export function GameAssetsSection(): JSX.Element {
  const [assets, setAssets] = useState<GameAssets>({})

  useEffect(() => {
    void ipc.invoke(ipc.channels.GameAssetsGet).then(setAssets).catch(() => {})
    return ipc.on(ipc.channels.EvtGameAssets, setAssets)
  }, [])

  const upload = (key: GameAssetKey): void => {
    void ipc.invoke(ipc.channels.GameAssetUpload, key).then(setAssets)
  }
  const clear = (key: GameAssetKey): void => {
    void ipc.invoke(ipc.channels.GameAssetClear, key).then(setAssets)
  }
  const apply = (key: GameAssetKey, opts: Pick<GameAsset, 'frames' | 'fps'>): void => {
    void ipc.invoke(ipc.channels.GameAssetSet, key, opts).then(setAssets)
  }

  return (
    <section className="space-y-4 rounded-xl bg-duck-panel p-5">
      <h2 className="text-sm font-semibold text-duck-accent">Game artwork</h2>
      <p className="text-xs text-white/50">
        Give the mini-games your own feel. Upload a single picture, or a horizontal sprite strip
        (then set how many frames it has) to animate it. Leave a slot empty to use the default.
      </p>

      <div className="space-y-2">
        {GAME_ASSETS.map((meta) => (
          <AssetRow
            key={meta.key}
            meta={meta}
            asset={assets[meta.key]}
            onUpload={() => upload(meta.key)}
            onClear={() => clear(meta.key)}
            onApply={(opts) => apply(meta.key, opts)}
          />
        ))}
      </div>
    </section>
  )
}

function AssetRow({
  meta,
  asset,
  onUpload,
  onClear,
  onApply
}: {
  meta: GameAssetMeta
  asset: GameAsset | undefined
  onUpload: () => void
  onClear: () => void
  onApply: (opts: Pick<GameAsset, 'frames' | 'fps'>) => void
}): JSX.Element {
  const [frames, setFrames] = useState(asset?.frames ?? 1)
  const [fps, setFps] = useState(asset?.fps ?? 8)

  useEffect(() => {
    setFrames(asset?.frames ?? 1)
    setFps(asset?.fps ?? 8)
  }, [asset?.frames, asset?.fps])

  const dirty = asset ? frames !== asset.frames || fps !== asset.fps : false

  return (
    <div className="rounded-lg bg-duck-shell p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded bg-black/30">
          {asset ? (
            <img
              src={asset.fileUrl}
              alt={meta.label}
              className="h-full w-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <span className="text-xl">{meta.fallback}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/80">{meta.label}</p>
          <p className="truncate text-[11px] text-white/40">{meta.hint}</p>
        </div>

        {asset ? (
          <span className="flex items-center gap-2">
            <button onClick={onUpload} className="text-[11px] text-duck-accent hover:underline">
              Replace
            </button>
            <button onClick={onClear} className="text-[11px] text-red-400 hover:underline">
              Remove
            </button>
          </span>
        ) : (
          <button
            onClick={onUpload}
            className="rounded bg-duck-accent/90 px-2.5 py-1 text-[11px] font-semibold"
          >
            Upload
          </button>
        )}
      </div>

      {asset && meta.animated && (
        <div className="mt-3 flex items-end gap-3">
          <label className="block">
            <span className="block text-[10px] text-white/50">Frames (strip)</span>
            <input
              type="number"
              min="1"
              value={frames}
              onChange={(e) => setFrames(Math.max(1, Number(e.target.value)))}
              className="w-24 rounded border border-white/10 bg-duck-panel px-1.5 py-1 text-xs outline-none focus:border-duck-accent"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] text-white/50">FPS</span>
            <input
              type="number"
              min="1"
              max="60"
              value={fps}
              onChange={(e) => setFps(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded border border-white/10 bg-duck-panel px-1.5 py-1 text-xs outline-none focus:border-duck-accent"
            />
          </label>
          <button
            onClick={() => onApply({ frames, fps })}
            disabled={!dirty}
            className="rounded bg-duck-accent px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
          >
            Apply
          </button>
          <span className="pb-1.5 text-[10px] text-white/30">
            {asset.imageWidth > 0 ? `${asset.imageWidth}×${asset.imageHeight}px` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
