import { screen, type Display } from 'electron'
import { IPC } from '@shared/ipc-contract'
import type { WindowManager } from '../windows/windowManager'

const TICK_MS = 16
const WALK_SPEED = 4 // px per tick — gentle stroll
const RUN_SPEED = 9 // px per tick — hurrying over to you
const RUN_DISTANCE = 340 // run when the target is far
const STOP_DISTANCE = 6 // close enough to the target — settle
const WIN_W = 300
const WIN_H = 300
/** Keep this far from the outer edge of the whole desktop so the duck never touches a boundary. */
const EDGE_MARGIN = 16
/** Fraction of each screen's height (measured from the bottom) the duck may never enter. */
const BOTTOM_RESERVE = 0.1

/**
 * The lowest Y the duck's BODY may occupy on a given display: 10% up from the
 * bottom of the full screen bounds. Using bounds (not workArea) makes this a
 * hard floor that holds even when Windows misreports the taskbar-free area.
 */
function bottomFloorBodyY(display: Display): number {
  const b = display.bounds
  return b.y + b.height * (1 - BOTTOM_RESERVE)
}
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

  /** Foreground (coding/AI) window rect in PHYSICAL pixels, or null. */
  private activeWinBounds: { x: number; y: number; w: number; h: number } | null = null

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

  /**
   * Instantly bring the duck back to a clearly visible spot on the monitor the
   * user is working on (centre of the work area, always on-screen). Clears any
   * "sit" or prompt-watch state so it's free to roam again. Used by the
   * "call duck back" shortcut as a rescue if it ever ends up out of reach.
   */
  recall(): void {
    const duck = this.windows.getDuckWindow()
    if (!duck || duck.isDestroyed()) return
    this.sitting = false
    this.promptWatch = null
    this.roamTarget = null
    this.roamDwellUntil = 0
    const cursor = screen.getCursorScreenPoint()
    const { workArea } = this.workDisplay(cursor)
    const bodyX = workArea.x + workArea.width / 2
    const bodyY = workArea.y + workArea.height / 2
    const { x, y } = this.clampWindow(Math.round(bodyX - ANCHOR_X), Math.round(bodyY - ANCHOR_Y))
    duck.setPosition(x, y)
  }

  /** Freeze all movement (e.g. while a mini-game owns the screen). */
  setPaused(paused: boolean): void {
    this.paused = paused
  }

  /**
   * Tell the duck which monitor the user is actually working on, derived from
   * the focused coding/AI window (physical-pixel rect). The duck stays on that
   * display and never follows the cursor onto another monitor or the desktop.
   * Pass null when unknown (falls back to the cursor's display).
   */
  setActiveWindowBounds(bounds: { x: number; y: number; w: number; h: number } | null): void {
    const valid =
      bounds &&
      [bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) &&
      bounds.w > 0 &&
      bounds.h > 0
        ? bounds
        : null
    this.activeWinBounds = valid
  }

  /**
   * Resolve the display the user is working on. Prefers the focused window's
   * display (so the duck lives where the editor/chat is, not where the mouse
   * wandered off to). Falls back to the cursor's display when we don't have a
   * window rect (e.g. macOS, or detection unavailable).
   */
  private workDisplay(cursor: Point): Display {
    const bounds = this.activeWinBounds
    if (bounds && process.platform === 'win32') {
      try {
        const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
        // GetWindowRect is in physical pixels; Electron's screen API is in DIPs.
        const dip = screen.screenToDipPoint(center)
        if (Number.isFinite(dip.x) && Number.isFinite(dip.y)) {
          return screen.getDisplayNearestPoint(dip)
        }
      } catch {
        // Fall through to the cursor display.
      }
    }
    return screen.getDisplayNearestPoint(cursor)
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

  /**
   * Pin the duck where it currently stands (target = its own position) so it
   * stops walking and can play a stationary animation like "coding" — movement
   * always visually overrides idle/reaction states, so the duck must be still
   * for the coding animation to actually show.
   */
  stayPut(): void {
    const duck = this.windows.getDuckWindow()
    if (!duck || duck.isDestroyed()) return
    const [winX, winY] = duck.getPosition()
    this.setPromptWatch({ x: winX + ANCHOR_X, y: winY + ANCHOR_Y })
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
    let [winX, winY] = duck.getPosition()

    // Safety net: every tick, make sure the duck is inside the safe area of its
    // monitor (above the taskbar, on-screen). If a display/taskbar change left it
    // out of bounds while it was standing still, pull it back in immediately.
    const safe = this.clampWindow(winX, winY)
    if (safe.x !== winX || safe.y !== winY) {
      duck.setPosition(safe.x, safe.y)
      winX = safe.x
      winY = safe.y
    }

    const bodyX = winX + ANCHOR_X
    const bodyY = winY + ANCHOR_Y
    const cursorFacing: 'left' | 'right' = cursor.x >= bodyX ? 'right' : 'left'

    if (this.sitting) {
      this.emit({ moving: false, fast: false, facing: cursorFacing })
      return
    }

    const workDisplay = this.workDisplay(cursor)

    // Live on whichever monitor the user is working on (the display that holds
    // the focused editor/AI window). If they've switched to a coding window on
    // another display, head over there — but never follow the cursor onto the
    // desktop or another monitor on its own.
    if (!this.promptWatch) {
      const duckDisplayId = screen.getDisplayNearestPoint({ x: bodyX, y: bodyY }).id
      if (duckDisplayId !== workDisplay.id) {
        this.roamTarget = this.randomBodyPoint(workDisplay)
        this.roamDwellUntil = 0
      }
    }

    const target = this.promptWatch ?? this.nextRoamTarget(workDisplay)
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
  private nextRoamTarget(workDisplay: Display): Point | null {
    if (Date.now() < this.roamDwellUntil) return null
    if (!this.roamTarget) {
      // Roam within the monitor that holds the focused editor/AI window, so the
      // duck stays where you're working instead of chasing the mouse cursor.
      this.roamTarget = this.randomBodyPoint(workDisplay)
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
   * Keeps the duck window on-screen. Horizontally it may roam across the whole
   * desktop (so side-by-side monitors work), but VERTICALLY it's clamped to the
   * monitor the duck is currently on. As a hard guarantee against ever walking
   * down through the taskbar on Windows, the duck's body is also kept out of the
   * bottom 10% of that screen (using the full display bounds, not just the work
   * area — so it holds even if the OS misreports the taskbar-free work area).
   */
  private clampWindow(x: number, y: number): Point {
    const displays = screen.getAllDisplays()
    if (displays.length === 0) return { x: safeInt(x, 0), y: safeInt(y, 0) }

    // Horizontal extent across every monitor (allows crossing between displays).
    let minX = Infinity
    let maxRight = -Infinity
    for (const display of displays) {
      const a = display.workArea
      minX = Math.min(minX, a.x)
      maxRight = Math.max(maxRight, a.x + a.width)
    }

    // Vertical bounds come from the single monitor the duck's body is over, so
    // we always respect THAT screen's taskbar/work area.
    const bodyPoint = { x: safeInt(x + ANCHOR_X, 0), y: safeInt(y + ANCHOR_Y, 0) }
    const display = screen.getDisplayNearestPoint(bodyPoint)
    const here = display.workArea
    const top = here.y + EDGE_MARGIN
    // The lowest the WINDOW top may go: whichever is higher (smaller Y) of the
    // work-area bottom and the 10%-from-bottom floor for the duck's body.
    const floorWinY = bottomFloorBodyY(display) - ANCHOR_Y
    const bottom = Math.min(here.y + here.height - WIN_H - EDGE_MARGIN, floorWinY)

    // Fractional display scaling (e.g. 150% on Windows) makes workArea values
    // non-integer; setPosition requires integers, so round the final result and
    // fall back to the input if anything came out non-finite.
    return {
      x: safeInt(clamp(x, minX + EDGE_MARGIN, maxRight - WIN_W - EDGE_MARGIN), x),
      y: safeInt(clamp(y, top, Math.max(top, bottom)), y)
    }
  }

  private randomBodyPoint(display: Display): Point {
    const workArea = display.workArea
    const minX = workArea.x + ANCHOR_X
    const maxX = workArea.x + workArea.width - (WIN_W - ANCHOR_X)
    const minY = workArea.y + ANCHOR_Y
    // Never pick a roam target inside the bottom 10% of the screen.
    const maxY = Math.min(workArea.y + workArea.height - (WIN_H - ANCHOR_Y), bottomFloorBodyY(display))
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
