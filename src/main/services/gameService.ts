import type { GameId } from '@shared/types'
import type { DuckMotionService } from './duckMotionService'
import type { VisibilityService } from './visibilityService'
import type { WindowManager } from '../windows/windowManager'

/**
 * Coordinates a mini-game session: while a game is on screen the duck's autopilot
 * (roaming + app-aware visibility) is paused and the duck window is hidden, so the
 * full-screen game overlay is the only thing the user interacts with.
 */
export class GameService {
  private active = false

  constructor(
    private readonly windows: WindowManager,
    private readonly motion: DuckMotionService,
    private readonly visibility: VisibilityService
  ) {}

  start(game: GameId): void {
    // The duck is hidden while playing, so a second game can't be launched from
    // it; `active` is effectively always false here, but guard anyway.
    this.active = true
    this.motion.setPaused(true)
    this.visibility.suspend()
    this.windows.setDuckHidden(true)
    this.windows.openGameWindow(game, () => this.handleClosed())
  }

  stop(): void {
    this.windows.closeGameWindow()
    // `closeGameWindow` destroys the window; its 'closed' handler resumes the duck.
  }

  /** Called when the game window is gone (stop button, ESC, or OS close). */
  private handleClosed(): void {
    if (!this.active) return
    this.active = false
    this.motion.setPaused(false)
    this.visibility.resume()
  }
}
