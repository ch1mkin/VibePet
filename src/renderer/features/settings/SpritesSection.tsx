import { useEffect, useState } from 'react'
import type { DuckAnimationState, SpriteClip, SpriteGeometry, SpriteSetup } from '@shared/types'
import { ipc } from '../../lib/ipc'
import { EMOJI_MAP } from '../../animations/emojiMap'
import { useSpriteSetup } from '../../hooks/useSpriteSetup'
import { AnimatedSprite } from '../../components/AnimatedSprite'

const STATES = Object.keys(EMOJI_MAP) as DuckAnimationState[]

/** Actions that most affect how "alive" the duck feels — surfaced first. */
const ESSENTIAL = new Set<DuckAnimationState>([
  'idle',
  'walking',
  'running',
  'sitting',
  'happy',
  'confused',
  'thinking',
  'readingDocs',
  'celebrating'
])

/**
 * Method 1 — per-action sprite sheets. Each action gets its own file plus frame
 * geometry (rows, columns, frame size, fps). Actions without a sheet (and not
 * covered by a master-atlas range) fall back to the emoji animation.
 */
export function SpritesSection(): JSX.Element {
  const setup = useSpriteSetup()

  const upload = (state: DuckAnimationState): void => {
    void ipc.invoke(ipc.channels.SpriteUploadFor, state)
  }
  const clear = (state: DuckAnimationState): void => {
    void ipc.invoke(ipc.channels.SpriteClear, state)
  }
  const setGeometry = (state: DuckAnimationState, g: SpriteGeometry): void => {
    void ipc.invoke(ipc.channels.SpriteSetGeometry, state, g)
  }

  const sorted = [...STATES].sort((a, b) => Number(ESSENTIAL.has(b)) - Number(ESSENTIAL.has(a)))

  return (
    <section className="space-y-4 rounded-xl bg-duck-panel p-5">
      <h2 className="text-sm font-semibold text-duck-accent">Sprite sheets · per action</h2>
      <p className="text-xs text-white/50">
        Upload a separate sheet per action and define its grid (rows × columns, frame size, fps).
        Frames are read left-to-right, top-to-bottom. <span className="text-duck-accent">★</span>{' '}
        marks the essentials. Prefer one big sheet? Use the master atlas below.
      </p>

      <BaseImageRow image={setup.baseImage} />

      <div className="space-y-2">
        {sorted.map((state) => (
          <ActionRow
            key={state}
            state={state}
            clip={setup.clips[state]}
            usedByAtlas={Boolean(setup.ranges[state] && setup.atlas)}
            onUpload={() => upload(state)}
            onClear={() => clear(state)}
            onApply={(g) => setGeometry(state, g)}
          />
        ))}
      </div>
    </section>
  )
}

function BaseImageRow({ image }: { image: SpriteSetup['baseImage'] }): JSX.Element {
  return (
    <div className="rounded-lg border border-duck-accent/30 bg-duck-shell p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {image ? (
            <img
              src={image.fileUrl}
              alt="Duck"
              className="h-12 w-12 rounded bg-black/20 object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded bg-black/20 text-3xl">🦆</span>
          )}
          <div>
            <p className="text-xs font-medium text-white/80">Duck image (replaces the emoji)</p>
            <p className="text-[11px] text-white/40">
              A single picture used wherever no sprite sheet is set — desktop + games. It still
              animates (idle bob, run, fly) via motion.
            </p>
          </div>
        </div>
        {image ? (
          <span className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void ipc.invoke(ipc.channels.SpriteUploadBase)}
              className="text-[11px] text-duck-accent hover:underline"
            >
              Replace
            </button>
            <button
              onClick={() => void ipc.invoke(ipc.channels.SpriteClearBase)}
              className="text-[11px] text-red-400 hover:underline"
            >
              Remove
            </button>
          </span>
        ) : (
          <button
            onClick={() => void ipc.invoke(ipc.channels.SpriteUploadBase)}
            className="shrink-0 rounded bg-duck-accent px-2.5 py-1 text-[11px] font-semibold"
          >
            Upload image
          </button>
        )}
      </div>
    </div>
  )
}

function ActionRow({
  state,
  clip,
  usedByAtlas,
  onUpload,
  onClear,
  onApply
}: {
  state: DuckAnimationState
  clip: SpriteClip | undefined
  usedByAtlas: boolean
  onUpload: () => void
  onClear: () => void
  onApply: (g: SpriteGeometry) => void
}): JSX.Element {
  return (
    <div className="rounded-lg bg-duck-shell p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/80">
          {ESSENTIAL.has(state) && <span className="text-duck-accent">★ </span>}
          {EMOJI_MAP[state].emoji} {EMOJI_MAP[state].label}
          <span className="ml-1 text-white/30">({state})</span>
          {usedByAtlas && <span className="ml-2 text-[10px] text-amber-300">atlas range active</span>}
        </span>
        {clip ? (
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
            Upload sheet
          </button>
        )}
      </div>

      {clip && <GeometryEditor clip={clip} onApply={onApply} />}
    </div>
  )
}

function GeometryEditor({
  clip,
  onApply
}: {
  clip: SpriteClip
  onApply: (g: SpriteGeometry) => void
}): JSX.Element {
  const [draft, setDraft] = useState<SpriteGeometry>(toGeometry(clip))
  const [playing, setPlaying] = useState(true)

  useEffect(() => setDraft(toGeometry(clip)), [clip])

  const set = (key: keyof SpriteGeometry, value: string): void =>
    setDraft((d) => ({ ...d, [key]: Number(value) }))

  const dirty =
    draft.frameWidth !== clip.frameWidth ||
    draft.frameHeight !== clip.frameHeight ||
    draft.rows !== clip.rows ||
    draft.columns !== clip.columns ||
    draft.frameCount !== clip.frameCount ||
    draft.fps !== clip.fps

  return (
    <div className="mt-3 flex gap-3">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <AnimatedSprite
          fileUrl={clip.fileUrl}
          frameWidth={draft.frameWidth}
          frameHeight={draft.frameHeight}
          columns={draft.columns}
          frameCount={draft.frameCount}
          fps={draft.fps}
          box={160}
          playing={playing}
        />
        <button
          onClick={() => setPlaying((p) => !p)}
          className="text-[10px] text-duck-accent hover:underline"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <span className="text-[9px] text-white/30">{dirty ? 'preview (unsaved)' : 'preview'}</span>
      </div>

      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <Num label="Frame W" value={draft.frameWidth} onChange={(v) => set('frameWidth', v)} />
          <Num label="Frame H" value={draft.frameHeight} onChange={(v) => set('frameHeight', v)} />
          <Num label="FPS" value={draft.fps} onChange={(v) => set('fps', v)} />
          <Num label="Rows" value={draft.rows} onChange={(v) => set('rows', v)} />
          <Num label="Columns" value={draft.columns} onChange={(v) => set('columns', v)} />
          <Num label="Frames" value={draft.frameCount} onChange={(v) => set('frameCount', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30">
            {clip.imageWidth > 0
              ? `sheet ${clip.imageWidth}×${clip.imageHeight}px`
              : 'sheet size unknown'}
          </span>
          <button
            onClick={() => onApply(draft)}
            disabled={!dirty}
            className="rounded bg-duck-accent px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function Num({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <label className="block">
      <span className="block text-[10px] text-white/50">{label}</span>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-white/10 bg-duck-panel px-1.5 py-1 text-xs outline-none focus:border-duck-accent"
      />
    </label>
  )
}

function toGeometry(clip: SpriteClip): SpriteGeometry {
  return {
    frameWidth: clip.frameWidth,
    frameHeight: clip.frameHeight,
    rows: clip.rows,
    columns: clip.columns,
    frameCount: clip.frameCount,
    fps: clip.fps
  }
}
