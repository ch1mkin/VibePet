import { screen, type Rectangle } from 'electron'
import { IPC } from '@shared/ipc-contract'
import type { WindowManager } from '../windows/windowManager'

const TICK_MS = 16
const WALK_SPEED = 7 // px per tick
const RUN_SPEED = 16
const RUN_DISTANCE = 340 // run when the target is far
const STOP_DISTANCE = 6 // close enough to the target — settle
const WIN_W = 300
const WIN_H = 300
/** Keep this far from the outer edge of the whole desktop so the duck never touches a boundary. */
const EDGE_MARGIN = 16
// Where the duck's body sits inside the window.
const ANCHOR_X = WIN_W / 2
const ANCHOR_Y = 235
// Roaming pauses.
const ROAM_DWELL_MIN_MS = 1500
const ROAM_DWELL_MAX_MS = 5000

const ROAM_LINES = ['exploring! 🦆', 'la la la~', 'just stretching my legs', 'wander time 🌿']

interface MotionState {
  moving: boolean
  fast: boolean
  facing: 'left' | 'right'
}

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Round to an integer, falling back to `fallback` when the value isn't finite. */
function safeInt(value: number, fallback: number): number {
  return Math.round(Number.isFinite(value) ? value : fallback)
}

/**
 * Drives the duck's position.
 *
 * Default: it does NOT track the cursor's position — it roams the screen at
 * random and simply faces the cursor's direction (keeping an eye on you).
 * When a prompt-watch point is set (user typing into an AI chat box), it walks
 * over to that point and waits there. "Sit/stay" freezes it in place.
 */
export class DuckMotionService {
  private timer: ReturnType<typeof setInterval> | null = null
  private last: MotionState = { moving: false, fast: false, facing: 'left' }
  private sitting = false
  private paused = false

  private roamTarget: Point | null = null
  private roamDwellUntil = 0
  private announcedRoam = false

  private promptWatch: Point | null = null

  constructor(private readonly windows: WindowManager) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  isSitting(): boolean {
    return this.sitting
  }

  toggleSit(): boolean {
    this.sitting = !this.sitting
    return this.sitting
  }

  /** Freeze all movement (e.g. while a mini-game owns the screen). */
  setPaused(paused: boolean): void {
    this.paused = paused
  }

  /** Point (duck body) to walk to while watching a prompt; null resumes roaming. */
  setPromptWatch(point: Point | null): void {
    // Ignore bogus coordinates (e.g. from Windows UI Automation) so the duck
    // never tries to walk to a non-finite point.
    const valid = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null
    this.promptWatch = valid
    if (valid) {
      this.roamTarget = null
      this.roamDwellUntil = 0
    }
  }

  private tick(): void {
    try {
      this.runTick()
    } catch (err) {
      // A transient screen/position error must never crash the whole app
      // (this previously surfaced as the "JavaScript error in the main process"
      // dialog when moving between monitors).
      console.error('[VibeDuck] duck motion tick failed:', err)
    }
  }

  private runTick(): void {
    if (this.paused) return
    const duck = this.windows.getDuckWindow()
    if (!duck || duck.isDestroyed() || !duck.isVisible()) {
      this.emit({ moving: false, fast: false, facing: this.last.facing })
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const [winX, winY] = duck.getPosition()
    const bodyX = winX + ANCHOR_X
    const bodyY = winY + ANCHOR_Y
    const cursorFacing: 'left' | 'right' = cursor.x >= bodyX ? 'right' : 'left'

    if (this.sitting) {
      this.emit({ moving: false, fast: false, facing: cursorFacing })
      return
    }

    // Live on whichever monitor the user is working on. If they've switched to a
    // coding window on another display, head over there (works across monitors,
    // never leaving the screen thanks to clampWindow below).
    if (!this.promptWatch) {
      const duckDisplayId = screen.getDisplayNearestPoint({ x: bodyX, y: bodyY }).id
      const cursorDisplay = screen.getDisplayNearestPoint(cursor)
      if (duckDisplayId !== cursorDisplay.id) {
        this.roamTarget = this.randomBodyPoint(cursorDisplay.workArea)
        this.roamDwellUntil = 0
      }
    }

    const target = this.promptWatch ?? this.nextRoamTarget(cursor)
    if (!target) {
      // Roaming is dwelling — stand still and watch the cursor.
      this.emit({ moving: false, fast: false, facing: cursorFacing })
      return
    }

    const targetWinX = target.x - ANCHOR_X
    const targetWinY = target.y - ANCHOR_Y
    const dx = targetWinX - winX
    const dy = targetWinY - winY
    const dist = Math.hypot(dx, dy)

    if (!Number.isFinite(dist) || dist <= STOP_DISTANCE) {
      if (!this.promptWatch) {
        // Reached a roam point — pause before wandering again.
        this.roamTarget = null
        this.roamDwellUntil =
          Date.now() + ROAM_DWELL_MIN_MS + Math.random() * (ROAM_DWELL_MAX_MS - ROAM_DWELL_MIN_MS)
      }
      this.emit({ moving: false, fast: false, facing: cursorFacing })
      return
    }

    const fast = dist > RUN_DISTANCE
    const step = Math.min(fast ? RUN_SPEED : WALK_SPEED, dist)
    const { x: nextX, y: nextY } = this.clampWindow(
      Math.round(winX + (dx / dist) * step),
      Math.round(winY + (dy / dist) * step)
    )
    duck.setPosition(nextX, nextY)

    // While walking it faces where it's going; standing still it watches the cursor.
    this.emit({ moving: true, fast, facing: dx >= 0 ? 'right' : 'left' })
  }

  /** Returns the current roam destination (body point), or null while dwelling. */
  private nextRoamTarget(cursor: Point): Point | null {
    if (Date.now() < this.roamDwellUntil) return null
    if (!this.roamTarget) {
      // Roam within the monitor the user is currently on (keeps the duck near
      // where you're working, while still letting it use either screen).
      const { workArea } = screen.getDisplayNearestPoint(cursor)
      this.roamTarget = this.randomBodyPoint(workArea)
      if (!this.announcedRoam) {
        this.announcedRoam = true
        this.windows.broadcast(IPC.EvtDuckSay, {
          text: ROAM_LINES[Math.floor(Math.random() * ROAM_LINES.length)],
          tone: 'tip'
        })
      }
    }
    return this.roamTarget
  }

  /**
   * Keeps the duck window fully inside the combined desktop (all monitors). It
   * may roam freely across adjacent displays, but can never end up off-screen —
   * which previously happened on Windows multi-monitor setups.
   */
  private clampWindow(x: number, y: number): Point {
    const displays = screen.getAllDisplays()
    if (displays.length === 0) return { x: safeInt(x, 0), y: safeInt(y, 0) }

    let minX = Infinity
    let minY = Infinity
    let maxRight = -Infinity
    let maxBottom = -Infinity
    for (const display of displays) {
      const a = display.workArea
      minX = Math.min(minX, a.x)
      minY = Math.min(minY, a.y)
      maxRight = Math.max(maxRight, a.x + a.width)
      maxBottom = Math.max(maxBottom, a.y + a.height)
    }
    // Fractional display scaling (e.g. 150% on Windows) makes workArea values
    // non-integer; setPosition requires integers, so round the final result and
    // fall back to the input if anything came out non-finite.
    return {
      x: safeInt(clamp(x, minX + EDGE_MARGIN, maxRight - WIN_W - EDGE_MARGIN), x),
      y: safeInt(clamp(y, minY + EDGE_MARGIN, maxBottom - WIN_H - EDGE_MARGIN), y)
    }
  }

  private randomBodyPoint(workArea: Rectangle): Point {
    const minX = workArea.x + ANCHOR_X
    const maxX = workArea.x + workArea.width - (WIN_W - ANCHOR_X)
    const minY = workArea.y + ANCHOR_Y
    const maxY = workArea.y + workArea.height - (WIN_H - ANCHOR_Y)
    return {
      x: minX + Math.random() * Math.max(1, maxX - minX),
      y: minY + Math.random() * Math.max(1, maxY - minY)
    }
  }

  private emit(state: MotionState): void {
    if (
      state.moving === this.last.moving &&
      state.fast === this.last.fast &&
      state.facing === this.last.facing
    ) {
      return
    }
    this.last = state
    this.windows.broadcast(IPC.EvtDuckMotion, state)
  }
}
