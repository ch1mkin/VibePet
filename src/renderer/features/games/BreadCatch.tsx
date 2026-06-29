import { useEffect, useRef, useState } from 'react'
import type { DuckAnimationState } from '@shared/types'
import { clamp, fitCanvas, formatTime, rand } from './gameUtils'
import { useGameLoop } from './useGameLoop'
import { frameIndex, readyImage, useGameAssets, type LoadedAsset } from './useGameAssets'
import { GameDuck } from './GameDuck'
import { GameOverCard, Meter, StatPill } from './Hud'

interface Bread {
  x: number
  y: number
  vy: number
  rot: number
  vr: number
}
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface State {
  w: number
  h: number
  duckX: number
  prevX: number
  breads: Bread[]
  sparks: Spark[]
  score: number
  happy: number
  celebrating: boolean
  elapsed: number
  duration: number
  status: 'play' | 'over'
  flash: number
  lastDrop: number
}

const DUCK_SIZE = 150 // a touch smaller than the desktop duck so it reads well in-game
const DUCK_FROM_BOTTOM = 130
const DUCK_SPEED = 340 // px/s — a steady, fixed stroll (it's fine if bread is missed)
const CATCH_X = 72
// Anti-spam: cap bread on screen + a minimum gap between drops.
const MAX_BREAD = 14
const DROP_COOLDOWN_MS = 130
const COLORS = ['#ffd24c', '#7c5cff', '#ff9b2f', '#5ad1a0', '#ff6b8b']

function makeState(): State {
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    duckX: window.innerWidth / 2,
    prevX: window.innerWidth / 2,
    breads: [],
    sparks: [],
    score: 0,
    happy: 0,
    celebrating: false,
    elapsed: 0,
    duration: Math.round(rand(25, 40)),
    status: 'play',
    flash: 0,
    lastDrop: 0
  }
}

/**
 * Bread Catch — click the top 20% of the screen to drop bread; the duck slides
 * along the bottom to catch it. Catches raise the happiness meter; at 100% the
 * duck throws a little party. Lasts 25–40s.
 */
export function BreadCatch({ onExit }: { onExit: () => void }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const duckRef = useRef<HTMLDivElement>(null)
  const g = useRef<State>(makeState())
  const assets = useGameAssets()
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  const [hud, setHud] = useState({ score: 0, happy: 0, timeLeft: g.current.duration, over: false })
  const [anim, setAnim] = useState<DuckAnimationState>('idle')
  const [facing, setFacing] = useState<'left' | 'right'>('left')

  useEffect(() => {
    const fit = (): void => {
      const canvas = canvasRef.current
      if (!canvas) return
      const r = fitCanvas(canvas)
      ctxRef.current = r.ctx
      const s = g.current
      s.w = r.w
      s.h = r.h
      s.duckX = clamp(s.duckX, 40, s.w - 40)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const reset = (): void => {
    g.current = makeState()
    setHud({ score: 0, happy: 0, timeLeft: g.current.duration, over: false })
  }

  const dropBread = (clientX: number, clientY: number): void => {
    const s = g.current
    if (s.status !== 'play') return
    // Bread can only be created from the top 20% of the screen.
    if (clientY > s.h * 0.2) return
    // Anti-spam: cap on screen + rate limit.
    if (s.breads.length >= MAX_BREAD) return
    const now = performance.now()
    if (now - s.lastDrop < DROP_COOLDOWN_MS) return
    s.lastDrop = now
    s.breads.push({
      x: clamp(clientX, 16, s.w - 16),
      y: clientY,
      vy: rand(150, 200) + s.elapsed * 4,
      rot: rand(-0.4, 0.4),
      vr: rand(-2, 2)
    })
  }

  useGameLoop((dt, now) => {
    const ctx = ctxRef.current
    if (!ctx) return
    const s = g.current
    const duckY = s.h - DUCK_FROM_BOTTOM

    if (s.status === 'play') {
      s.elapsed += dt
      const timeLeft = s.duration - s.elapsed
      if (timeLeft <= 0) s.status = 'over'

      // Duck chases the most urgent (lowest) bread.
      let target: Bread | null = null
      for (const b of s.breads) if (!target || b.y > target.y) target = b
      if (target) {
        const dx = target.x - s.duckX
        const step = DUCK_SPEED * dt
        s.duckX += clamp(dx, -step, step)
      }
      s.duckX = clamp(s.duckX, 40, s.w - 40)

      // Move bread + resolve catches/misses.
      for (let i = s.breads.length - 1; i >= 0; i--) {
        const b = s.breads[i]
        b.y += b.vy * dt
        b.rot += b.vr * dt
        const caught =
          b.y >= duckY - 48 && b.y <= duckY + 26 && Math.abs(b.x - s.duckX) < CATCH_X
        if (caught) {
          s.breads.splice(i, 1)
          s.score += 1
          s.happy = clamp(s.happy + 8, 0, 100)
          s.flash = 0.35
          burst(s, s.duckX, duckY - 30, 10)
          if (s.happy >= 100 && !s.celebrating) {
            s.celebrating = true
            burst(s, s.duckX, duckY - 30, 60)
          }
          continue
        }
        if (b.y > s.h + 30) {
          // Missing bread is totally fine — no happiness penalty.
          s.breads.splice(i, 1)
        }
      }
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt)
    }

    // Sparks (confetti) always animate.
    for (let i = s.sparks.length - 1; i >= 0; i--) {
      const p = s.sparks[i]
      p.vy += 900 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0 || p.y > s.h + 20) s.sparks.splice(i, 1)
    }
    if (s.celebrating && s.status === 'play' && Math.random() < 0.3) {
      burst(s, rand(0, s.w), -10, 1)
    }

    draw(ctx, s, now, assetsRef.current['breadCatch.bread'])

    // Drive the duck overlay: walking when it slides, celebrating on a catch/party.
    const dx = s.duckX - s.prevX
    if (dx > 0.6) setFacing('right')
    else if (dx < -0.6) setFacing('left')
    const moving = Math.abs(dx) > 0.6
    setAnim(s.flash > 0 || s.celebrating ? 'celebrating' : moving ? 'walking' : 'idle')
    s.prevX = s.duckX
    if (duckRef.current) {
      duckRef.current.style.transform = `translate(${s.duckX}px, ${duckY}px) translate(-50%, -50%)`
    }

    setHud((prev) => {
      const timeLeft = Math.max(0, s.duration - s.elapsed)
      const over = s.status === 'over'
      if (prev.score === s.score && prev.happy === s.happy && Math.ceil(prev.timeLeft) === Math.ceil(timeLeft) && prev.over === over) {
        return prev
      }
      return { score: s.score, happy: s.happy, timeLeft, over }
    })
  })

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={(e) => dropBread(e.clientX, e.clientY)}
      />

      <div ref={duckRef} className="pointer-events-none absolute left-0 top-0 z-[1] will-change-transform">
        <GameDuck state={anim} facing={facing} size={DUCK_SIZE} />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-3">
        <StatPill label="TIME" value={formatTime(hud.timeLeft)} />
        <StatPill label="BREAD" value={hud.score.toString()} />
        <Meter label="JOY" value={hud.happy} />
      </div>

      {!hud.over && (
        <div
          className="pointer-events-none absolute inset-x-0 top-[20%] z-10 -translate-y-7 text-center font-pixel text-[10px] text-white/80"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          ↑ tap up here to drop bread ↑
        </div>
      )}

      {hud.over && (
        <GameOverCard
          title={hud.happy >= 100 ? 'MAX JOY! 🎉' : "Time's up!"}
          lines={[
            { label: 'Bread caught', value: hud.score.toString() },
            { label: 'Happiness', value: `${Math.round(hud.happy)}%` }
          ]}
          onReplay={reset}
          onExit={onExit}
        />
      )}
    </>
  )
}

function burst(s: State, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    s.sparks.push({
      x,
      y,
      vx: rand(-160, 160),
      vy: rand(-320, -60),
      life: rand(0.6, 1.4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    })
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  s: State,
  now: number,
  breadAsset: LoadedAsset | undefined
): void {
  const { w, h } = s
  // Transparent background — the desktop/code shows through.
  ctx.clearRect(0, 0, w, h)

  // Drop-zone line at 20% (the only persistent guide).
  ctx.save()
  ctx.strokeStyle = 'rgba(255,210,76,0.55)'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.moveTo(0, h * 0.2)
  ctx.lineTo(w, h * 0.2)
  ctx.stroke()
  ctx.restore()

  // Bread — custom sprite if uploaded, otherwise the 🍞 emoji.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '34px serif'
  const breadImg = breadAsset ? readyImage(breadAsset) : null
  for (const b of s.breads) {
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(b.rot)
    if (breadImg && breadAsset) {
      const fw = breadImg.naturalWidth / breadAsset.frames
      const fh = breadImg.naturalHeight
      const dh = 44
      const dw = (fw / fh) * dh
      const sx = frameIndex(breadAsset, now) * fw
      ctx.drawImage(breadImg, sx, 0, fw, fh, -dw / 2, -dh / 2, dw, dh)
    } else {
      ctx.fillText('🍞', 0, 0)
    }
    ctx.restore()
  }

  // (The duck itself is a DOM overlay so it can use sprite-sheet animations.)

  // Sparks.
  for (const p of s.sparks) {
    ctx.globalAlpha = clamp(p.life, 0, 1)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x, p.y, 6, 6)
  }
  ctx.globalAlpha = 1
}
