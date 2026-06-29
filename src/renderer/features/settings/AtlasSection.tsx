import { useEffect, useState } from 'react'
import type { DuckAnimationState, SpriteAtlas, SpriteGeometry } from '@shared/types'
import { ipc } from '../../lib/ipc'
import { EMOJI_MAP } from '../../animations/emojiMap'
import { useSpriteSetup } from '../../hooks/useSpriteSetup'
import { AnimatedSprite } from '../../components/AnimatedSprite'

const STATES = Object.keys(EMOJI_MAP) as DuckAnimationState[]
const CELL = 40

/**
 * Method 2 — one master sheet, many animations. Upload a single big sprite sheet,
 * define its grid, then drag across the frames to select a range and assign it to
 * an action via the dropdown. No need to slice files manually.
 */
export function AtlasSection(): JSX.Element {
  const setup = useSpriteSetup()
  const atlas = setup.atlas

  return (
    <section className="space-y-4 rounded-xl bg-duck-panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-duck-accent">Master atlas · range select</h2>
        {atlas ? (
          <button
            onClick={() => void ipc.invoke(ipc.channels.SpriteClearAtlas)}
            className="text-[11px] text-red-400 hover:underline"
          >
            Remove atlas
          </button>
        ) : (
          <button
            onClick={() => void ipc.invoke(ipc.channels.SpriteUploadAtlas)}
            className="rounded-lg bg-duck-accent px-3 py-1.5 text-xs font-semibold"
          >
            Upload master sheet
          </button>
        )}
      </div>

      {!atlas ? (
        <p className="text-xs text-white/50">
          Upload one sheet that contains all your frames (e.g. a single row of 100+ columns). Then
          define the grid, drag to select a range of frames, and assign it to any action.
        </p>
      ) : (
        <AtlasEditor atlas={atlas} ranges={setup.ranges} />
      )}
    </section>
  )
}

function AtlasEditor({
  atlas,
  ranges
}: {
  atlas: SpriteAtlas
  ranges: Partial<Record<DuckAnimationState, { from: number; to: number; fps?: number }>>
}): JSX.Element {
  const total = Math.max(1, atlas.frameCount)
  const [sel, setSel] = useState({ from: 0, to: Math.min(7, total - 1) })
  const [dragAnchor, setDragAnchor] = useState<number | null>(null)
  const [target, setTarget] = useState<DuckAnimationState>('walking')
  const [fps, setFps] = useState(atlas.fps)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    setFps(atlas.fps)
    setSel((s) => ({ from: Math.min(s.from, total - 1), to: Math.min(s.to, total - 1) }))
  }, [atlas.fps, total])

  // Drag selection: mousedown sets an anchor, hovering extends the range.
  useEffect(() => {
    const stop = (): void => setDragAnchor(null)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const onCellDown = (i: number): void => {
    setDragAnchor(i)
    setSel({ from: i, to: i })
  }
  const onCellEnter = (i: number): void => {
    if (dragAnchor === null) return
    setSel({ from: Math.min(dragAnchor, i), to: Math.max(dragAnchor, i) })
  }

  const assign = (): void => {
    void ipc.invoke(ipc.channels.SpriteSetRange, target, { from: sel.from, to: sel.to, fps })
  }

  const count = sel.to - sel.from + 1

  return (
    <div className="space-y-4">
      <AtlasGeometry atlas={atlas} />

      {/* Frame grid — drag across to select a range. */}
      <div>
        <p className="mb-1 text-[11px] text-white/50">
          Drag across frames to select a range (row-major order).
        </p>
        <div className="max-h-56 overflow-auto rounded-lg bg-black/20 p-2">
          <div
            className="grid w-max gap-[2px] select-none"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, atlas.columns)}, ${CELL}px)` }}
          >
            {Array.from({ length: total }, (_, i) => {
              const inRange = i >= sel.from && i <= sel.to
              return (
                <div
                  key={i}
                  onMouseDown={() => onCellDown(i)}
                  onMouseEnter={() => onCellEnter(i)}
                  title={`Frame ${i}`}
                  className={`relative cursor-pointer rounded ${
                    inRange ? 'ring-2 ring-duck-accent' : 'ring-1 ring-white/10'
                  }`}
                  style={{ width: CELL, height: CELL }}
                >
                  <AnimatedSprite
                    fileUrl={atlas.fileUrl}
                    frameWidth={atlas.frameWidth}
                    frameHeight={atlas.frameHeight}
                    columns={atlas.columns}
                    frameCount={1}
                    fps={1}
                    startFrame={i}
                    box={CELL}
                    playing={false}
                  />
                  <span className="absolute bottom-0 right-0 bg-black/60 px-0.5 text-[8px] leading-none text-white/70">
                    {i}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selection preview + assignment. */}
      <div className="flex items-start gap-3 rounded-lg bg-duck-shell p-3">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <AnimatedSprite
            fileUrl={atlas.fileUrl}
            frameWidth={atlas.frameWidth}
            frameHeight={atlas.frameHeight}
            columns={atlas.columns}
            frameCount={count}
            fps={fps}
            startFrame={sel.from}
            box={80}
            playing={playing}
          />
          <button
            onClick={() => setPlaying((p) => !p)}
            className="text-[10px] text-duck-accent hover:underline"
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-xs text-white/70">
            Selection: frames <span className="text-white">{sel.from}</span>–
            <span className="text-white">{sel.to}</span>{' '}
            <span className="text-white/40">({count} frames)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Num label="From" value={sel.from} onChange={(v) => setSel((s) => ({ ...s, from: clampIdx(v, total) }))} />
            <Num label="To" value={sel.to} onChange={(v) => setSel((s) => ({ ...s, to: clampIdx(v, total) }))} />
            <Num label="FPS" value={fps} onChange={(v) => setFps(Math.max(1, Number(v) || 1))} />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as DuckAnimationState)}
              className="flex-1 rounded border border-white/10 bg-duck-panel px-2 py-1.5 text-xs outline-none focus:border-duck-accent"
            >
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {EMOJI_MAP[s].emoji} {EMOJI_MAP[s].label} ({s})
                </option>
              ))}
            </select>
            <button
              onClick={assign}
              className="rounded bg-duck-accent px-3 py-1.5 text-xs font-semibold"
            >
              Assign
            </button>
          </div>
        </div>
      </div>

      {/* Existing range assignments. */}
      <RangeList atlas={atlas} ranges={ranges} />
    </div>
  )
}

function RangeList({
  atlas,
  ranges
}: {
  atlas: SpriteAtlas
  ranges: Partial<Record<DuckAnimationState, { from: number; to: number; fps?: number }>>
}): JSX.Element {
  const entries = (Object.keys(ranges) as DuckAnimationState[]).filter((s) => ranges[s])
  if (entries.length === 0) {
    return <p className="text-[11px] text-white/40">No actions assigned from this atlas yet.</p>
  }
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-white/50">Assigned actions</p>
      {entries.map((state) => {
        const r = ranges[state]!
        return (
          <div
            key={state}
            className="flex items-center justify-between rounded-lg bg-duck-shell px-3 py-2"
          >
            <span className="flex items-center gap-2 text-xs">
              <AnimatedSprite
                fileUrl={atlas.fileUrl}
                frameWidth={atlas.frameWidth}
                frameHeight={atlas.frameHeight}
                columns={atlas.columns}
                frameCount={Math.max(1, r.to - r.from + 1)}
                fps={r.fps ?? atlas.fps}
                startFrame={r.from}
                box={32}
              />
              <span className="text-white/80">
                {EMOJI_MAP[state].emoji} {EMOJI_MAP[state].label}
              </span>
              <span className="text-white/40">
                frames {r.from}–{r.to} @ {r.fps ?? atlas.fps}fps
              </span>
            </span>
            <button
              onClick={() => void ipc.invoke(ipc.channels.SpriteSetRange, state, null)}
              className="text-[11px] text-red-400 hover:underline"
            >
              Remove
            </button>
          </div>
        )
      })}
    </div>
  )
}

function AtlasGeometry({ atlas }: { atlas: SpriteAtlas }): JSX.Element {
  const [draft, setDraft] = useState<SpriteGeometry>(toGeometry(atlas))

  useEffect(() => setDraft(toGeometry(atlas)), [atlas])

  const set = (key: keyof SpriteGeometry, value: string): void =>
    setDraft((d) => ({ ...d, [key]: Number(value) }))
  const dirty = (Object.keys(draft) as (keyof SpriteGeometry)[]).some((k) => draft[k] !== atlas[k])

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-white/50">
        Grid {atlas.imageWidth > 0 ? `· sheet ${atlas.imageWidth}×${atlas.imageHeight}px` : ''} — for
        a single row, set Rows 1 and Columns = total frames.
      </p>
      <div className="grid grid-cols-6 gap-2">
        <Num label="Frame W" value={draft.frameWidth} onChange={(v) => set('frameWidth', v)} />
        <Num label="Frame H" value={draft.frameHeight} onChange={(v) => set('frameHeight', v)} />
        <Num label="Rows" value={draft.rows} onChange={(v) => set('rows', v)} />
        <Num label="Columns" value={draft.columns} onChange={(v) => set('columns', v)} />
        <Num label="Frames" value={draft.frameCount} onChange={(v) => set('frameCount', v)} />
        <Num label="FPS" value={draft.fps} onChange={(v) => set('fps', v)} />
      </div>
      <button
        onClick={() => void ipc.invoke(ipc.channels.SpriteSetAtlasGeometry, draft)}
        disabled={!dirty}
        className="rounded bg-duck-accent px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
      >
        Apply grid
      </button>
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
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-white/10 bg-duck-panel px-1.5 py-1 text-xs outline-none focus:border-duck-accent"
      />
    </label>
  )
}

function clampIdx(value: string, total: number): number {
  return Math.max(0, Math.min(total - 1, Number(value) || 0))
}

function toGeometry(a: SpriteAtlas): SpriteGeometry {
  return {
    frameWidth: a.frameWidth,
    frameHeight: a.frameHeight,
    rows: a.rows,
    columns: a.columns,
    frameCount: a.frameCount,
    fps: a.fps
  }
}
