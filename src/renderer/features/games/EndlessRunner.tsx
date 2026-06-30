import { useEffect, useRef, useState } from 'react'
import type { DuckAnimationState } from '@shared/types'
import { ipc } from '../../lib/ipc'
import { clamp, fitCanvas, formatScore, rand } from './gameUtils'
import { useGameLoop } from './useGameLoop'
import { frameIndex, readyImage, useGameAssets, type LoadedAsset } from './useGameAssets'
import { GameDuck } from './GameDuck'
import { GameOverCard, StatPill } from './Hud'

interface Obstacle {
  x: number
  w: number
  h: number
}

interface State {
  w: number
  h: number
  groundY: number
  duckY: number // feet position
  vy: number
  grounded: boolean
  obstacles: Obstacle[]
  spawnIn: number
  speed: number
  dist: number
  scroll: number
  status: 'play' | 'over'
  started: boolean
}

const DUCK_X = 150
const DUCK_SIZE = 150 // a touch smaller than the desktop duck so it reads well in-game
// Sprite frames usually have transparent padding at the bottom; nudge the duck
// down by this fraction of its size so its feet visually rest on the ground line.
const FOOT_TRIM = DUCK_SIZE * 0.14
const GRAVITY = 2800
const JUMP_V = -1020
const BASE_SPEED = 360
const HIGH_KEY = 'game.runner.high'

function makeState(): State {
  const h = window.innerHeight
  return {
    w: window.innerWidth,
    h,
    groundY: h - 130,
    duckY: h - 130,
    vy: 0,
    grounded: true,
    obstacles: [],
    spawnIn: 2,
    speed: BASE_SPEED,
    dist: 0,
    scroll: 0,
    status: 'play',
    started: false
  }
}

/**
 * Duck Runner — a Chrome-dino style endless runner. Tap anywhere (or Space) to
 * jump over the cacti; survive as long as you can. Score and high score show in
 * the corner.
 */
export function EndlessRunner({ onExit }: { onExit: () => void }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const duckRef = useRef<HTMLDivElement>(null)
  const g = useRef<State>(makeState())
  const assets = useGameAssets()
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  const [hud, setHud] = useState({ score: 0, high: 0, over: false, started: false })
  const [anim, setAnim] = useState<DuckAnimationState>('idle')

  useEffect(() => {
    void ipc
      .invoke(ipc.channels.SettingsGet, HIGH_KEY)
      .then((v) => setHud((p) => ({ ...p, high: v ? parseInt(v, 10) || 0 : 0 })))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const fit = (): void => {
      const canvas = canvasRef.current
      if (!canvas) return
      const r = fitCanvas(canvas)
      ctxRef.current = r.ctx
      const s = g.current
      s.w = r.w
      s.h = r.h
      s.groundY = s.h - 130
      if (s.grounded) s.duckY = s.groundY
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const jump = (): void => {
    const s = g.current
    if (s.status !== 'play') return
    s.started = true
    if (s.grounded) {
      s.vy = JUMP_V
      s.grounded = false
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reset = (): void => {
    g.current = makeState()
    setHud((p) => ({ ...p, score: 0, over: false, started: false }))
  }

  const endGame = (s: State): void => {
    s.status = 'over'
    const score = Math.floor(s.dist / 10)
    setHud((prev) => {
      const high = Math.max(prev.high, score)
      if (high > prev.high) void ipc.invoke(ipc.channels.SettingsSet, HIGH_KEY, String(high)).catch(() => {})
      return { ...prev, score, high, over: true }
    })
  }

  useGameLoop((dt, now) => {
    const ctx = ctxRef.current
    if (!ctx) return
    const s = g.current

    if (s.status === 'play' && s.started) {
      // Speed creeps up slowly with distance (gentle ramp, capped).
      s.speed = BASE_SPEED + Math.min(360, s.dist * 0.025)
      s.dist += s.speed * dt
      s.scroll = (s.scroll + s.speed * dt) % 40

      // Physics.
      s.vy += GRAVITY * dt
      s.duckY += s.vy * dt
      if (s.duckY >= s.groundY) {
        s.duckY = s.groundY
        s.vy = 0
        s.grounded = true
      }

      // Spawn + move obstacles.
      s.spawnIn -= dt
      if (s.spawnIn <= 0) {
        const oh = rand(40, 78)
        // Keep custom obstacle art at its natural aspect ratio.
        const obs = assetsRef.current['runner.obstacle']
        const oimg = obs ? readyImage(obs) : null
        // Default pixel cactus keeps the website artwork's aspect ratio.
        let ow = oh * 0.62
        if (oimg && obs) ow = (oimg.naturalWidth / obs.frames / oimg.naturalHeight) * oh
        s.obstacles.push({ x: s.w + 20, w: ow, h: oh })
        // Cacti start sparse and gradually get more frequent as the score climbs
        // (difficulty ramps 0→1 over ~the first stretch). Gaps also scale with
        // speed so they stay clearable.
        const difficulty = Math.min(1, s.dist / 7000)
        const minGap = 1.5 - 0.8 * difficulty // 1.5s early → 0.7s late
        const maxGap = 2.4 - 1.1 * difficulty // 2.4s early → 1.3s late
        s.spawnIn = clamp(rand(minGap, maxGap) * (BASE_SPEED / s.speed), 0.6, 2.6)
      }
      // Hitbox sits in the duck's lower body — forgiving relative to the sprite.
      const duckBox = {
        x: DUCK_X - DUCK_SIZE * 0.17,
        y: s.duckY - DUCK_SIZE * 0.46,
        w: DUCK_SIZE * 0.34,
        h: DUCK_SIZE * 0.46
      }
      for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const o = s.obstacles[i]
        o.x -= s.speed * dt
        if (o.x + o.w < -10) {
          s.obstacles.splice(i, 1)
          continue
        }
        const ob = { x: o.x, y: s.groundY - o.h, w: o.w, h: o.h }
        if (
          duckBox.x < ob.x + ob.w &&
          duckBox.x + duckBox.w > ob.x &&
          duckBox.y < ob.y + ob.h &&
          duckBox.y + duckBox.h > ob.y
        ) {
          endGame(s)
          break
        }
      }
    }

    drawRunner(ctx, s, now, assetsRef.current['runner.obstacle'], assetsRef.current['runner.ground'])

    // The runner duck is ALWAYS running (in place before start, mid-jump it flies);
    // it never falls back to a static/idle pose while the game is live.
    setAnim(s.status === 'over' ? 'idle' : s.grounded ? 'running' : 'flying')
    if (duckRef.current) {
      duckRef.current.style.transform = `translate(${DUCK_X}px, ${s.duckY + FOOT_TRIM}px) translate(-50%, -100%)`
    }

    const score = Math.floor(s.dist / 10)
    setHud((prev) =>
      prev.score === score && prev.started === s.started && prev.over === (s.status === 'over')
        ? prev
        : { ...prev, score, started: s.started, over: s.status === 'over' }
    )
  })

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={jump}
      />

      <div ref={duckRef} className="pointer-events-none absolute left-0 top-0 z-[1] will-change-transform">
        <GameDuck state={anim} facing="right" size={DUCK_SIZE} />
      </div>

      <div className="pointer-events-none absolute right-4 top-20 z-10 flex flex-col items-end gap-2">
        <StatPill label="SCORE" value={formatScore(hud.score)} />
        <StatPill label="HI" value={formatScore(hud.high)} />
      </div>

      {!hud.started && !hud.over && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="pixel-panel px-6 py-4 text-center font-pixel text-white">
            <p className="text-sm text-duck-yellow">Duck Runner</p>
            <p className="mt-3 text-[10px] text-white/70">tap anywhere / Space to jump</p>
          </div>
        </div>
      )}

      {hud.over && (
        <GameOverCard
          title="Game Over"
          lines={[
            { label: 'Score', value: formatScore(hud.score) },
            { label: 'Best', value: formatScore(hud.high) }
          ]}
          onReplay={reset}
          onExit={onExit}
        />
      )}
    </>
  )
}

function drawRunner(
  ctx: CanvasRenderingContext2D,
  s: State,
  now: number,
  obstacleAsset: LoadedAsset | undefined,
  groundAsset: LoadedAsset | undefined
): void {
  const { w, h, groundY } = s
  // Transparent background — the desktop/code shows through.
  ctx.clearRect(0, 0, w, h)

  // Ground — tiled custom platform if uploaded, otherwise a line + dashes.
  const groundImg = groundAsset ? readyImage(groundAsset) : null
  if (groundImg) {
    const gh = 72
    const tileW = (groundImg.naturalWidth / groundImg.naturalHeight) * gh
    for (let x = -(s.scroll % tileW); x < w; x += tileW) {
      ctx.drawImage(groundImg, x, groundY + 6, tileW, gh)
    }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, groundY + 6)
    ctx.lineTo(w, groundY + 6)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    for (let x = -40 + (40 - s.scroll); x < w; x += 40) {
      ctx.fillRect(x, groundY + 18, 18, 4)
    }
  }

  // Obstacles — custom sprite if uploaded, otherwise pixel cacti.
  const obstacleImg = obstacleAsset ? readyImage(obstacleAsset) : null
  for (const o of s.obstacles) {
    if (obstacleImg && obstacleAsset) {
      const fw = obstacleImg.naturalWidth / obstacleAsset.frames
      const sx = frameIndex(obstacleAsset, now) * fw
      ctx.drawImage(obstacleImg, sx, 0, fw, obstacleImg.naturalHeight, o.x, groundY - o.h, o.w, o.h)
    } else {
      drawCactus(ctx, o.x, groundY - o.h, o.w, o.h)
    }
  }

  // (The duck itself is a DOM overlay so it can use sprite-sheet animations.)
}

// Pixel-art cactus map (11×14), identical to the website's <PixelCactus />.
// 1 = body, 0 = empty.
const CACTUS_MAP = [
  '00000100000',
  '00000110000',
  '00100110000',
  '01100111001',
  '01101111011',
  '01111111011',
  '00111111110',
  '00011111100',
  '00001111000',
  '00001111000',
  '00001111000',
  '00001111000',
  '00011111100',
  '00011111100'
]
const CACTUS_COLS = 11
const CACTUS_ROWS = 14

/**
 * Draws the same chunky pixel cactus used on the marketing site: a checker-shaded
 * green body with a darker pixel-shadow along its left and bottom edges. The 11×14
 * grid is scaled to fit the obstacle's bounding box (x, y = top-left; w, h = size).
 */
function drawCactus(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cw = w / CACTUS_COLS
  const ch = h / CACTUS_ROWS
  for (let row = 0; row < CACTUS_ROWS; row++) {
    const line = CACTUS_MAP[row]
    for (let col = 0; col < CACTUS_COLS; col++) {
      if (line[col] === '0') continue
      const px = x + col * cw
      const py = y + row * ch
      // Body with subtle checker shading.
      ctx.fillStyle = (col + row) % 4 === 0 ? '#2f7d45' : '#3fa45b'
      ctx.fillRect(px, py, cw + 0.6, ch + 0.6)
      // Dark pixel-shadow on exposed left / bottom edges.
      const leftEmpty = col === 0 || line[col - 1] === '0'
      const below = CACTUS_MAP[row + 1]
      const belowEmpty = row === CACTUS_ROWS - 1 || !below || below[col] === '0'
      if (leftEmpty || belowEmpty) {
        ctx.fillStyle = 'rgba(29,82,48,0.55)'
        ctx.fillRect(px, py, cw + 0.6, ch + 0.6)
      }
    }
  }
}
