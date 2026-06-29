import type { ReactNode } from 'react'

/** A chunky retro button. */
export function PixelButton({
  children,
  onClick,
  variant = 'default'
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'default' | 'accent' | 'danger'
}): JSX.Element {
  const cls =
    variant === 'accent' ? 'pixel-btn pixel-btn-accent' : variant === 'danger' ? 'pixel-btn pixel-btn-danger' : 'pixel-btn'
  return (
    <button
      type="button"
      className={cls}
      // Don't let a click bubble to the canvas (which would jump / drop bread).
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

/** A small label/value readout (timer, score…). */
export function StatPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="pixel-panel px-3 py-2 text-white">
      <span className="mr-2 text-[9px] text-white/50">{label}</span>
      <span className="text-[13px] tracking-wider">{value}</span>
    </div>
  )
}

/** Horizontal progress meter (0–100). */
export function Meter({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="font-pixel text-[9px] text-white/70">{label}</span>
      <div className="pixel-meter">
        <div className="pixel-meter-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

/** End-of-game summary with replay/exit actions. */
export function GameOverCard({
  title,
  lines,
  onReplay,
  onExit
}: {
  title: string
  lines: { label: string; value: string }[]
  onReplay: () => void
  onExit: () => void
}): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pixel-panel pointer-events-auto w-[340px] p-6 text-center text-white">
        <h2 className="font-pixel text-base text-duck-yellow">{title}</h2>
        <div className="my-5 space-y-2">
          {lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between font-pixel text-[11px]">
              <span className="text-white/55">{l.label}</span>
              <span className="text-white">{l.value}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          <PixelButton variant="accent" onClick={onReplay}>
            Play again
          </PixelButton>
          <PixelButton onClick={onExit}>Done</PixelButton>
        </div>
      </div>
    </div>
  )
}
