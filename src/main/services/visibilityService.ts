import { DEFAULT_VISIBILITY, type VisibilityConfig } from '@shared/types'
import type { ActiveAppAdapter, ActiveAppInfo } from '../platform/activeApp'
import type { SettingsRepository } from '../database/repositories/settingsRepository'

const SETTINGS_KEY = 'visibility.config'
const POLL_MS = 1200

/**
 * Polls the foreground app and decides whether the duck should be visible.
 *
 * Philosophy: only show the duck on coding/AI surfaces — but *fail open*. If
 * detection itself fails (no permission, unknown OS), we show the duck rather
 * than leaving the user staring at an empty desktop.
 */
export class VisibilityService {
  private config: VisibilityConfig
  private timer: ReturnType<typeof setInterval> | null = null
  private lastVisible: boolean | null = null
  private suspended = false

  constructor(
    private readonly activeApp: ActiveAppAdapter,
    private readonly settings: SettingsRepository,
    private readonly onChange: (visible: boolean) => void,
    /** Reports the focused window's physical-pixel rect (Windows) each poll. */
    private readonly onActiveWindow?: (
      bounds: { x: number; y: number; w: number; h: number } | null
    ) => void
  ) {
    this.config = this.load()
  }

  start(): void {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), POLL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  getConfig(): VisibilityConfig {
    return this.config
  }

  /** Stop toggling the duck (e.g. a mini-game has taken over the screen). */
  suspend(): void {
    this.suspended = true
  }

  /** Resume app-aware visibility and immediately re-evaluate. */
  resume(): void {
    this.suspended = false
    this.lastVisible = null
    void this.tick()
  }

  setConfig(config: VisibilityConfig): void {
    this.config = config
    this.settings.set(SETTINGS_KEY, JSON.stringify(config))
    this.lastVisible = null // force re-evaluation on next tick
    void this.tick()
  }

  private async tick(): Promise<void> {
    if (this.suspended) return
    const visible = await this.computeVisible()
    if (visible !== this.lastVisible) {
      this.lastVisible = visible
      this.onChange(visible)
    }
  }

  private async computeVisible(): Promise<boolean> {
    if (!this.config.enabled) {
      this.onActiveWindow?.(null)
      return true
    }
    const info = await this.activeApp.getActive()
    if (!info) {
      this.onActiveWindow?.(null)
      return true // fail open: detection unavailable
    }
    const visible = matches(info, this.config)
    // Tell the duck which monitor the focused coding/AI window lives on so it
    // stays there instead of chasing the cursor across screens.
    this.onActiveWindow?.(visible ? info.bounds ?? null : null)
    console.log(
      `[VibeDuck] active app="${info.appName}"${info.url ? ` url=${info.url}` : ''} -> duck ${visible ? 'shown' : 'hidden'}`
    )
    return visible
  }

  private load(): VisibilityConfig {
    const stored = this.settings.get(SETTINGS_KEY)
    if (!stored) return DEFAULT_VISIBILITY
    try {
      return { ...DEFAULT_VISIBILITY, ...(JSON.parse(stored) as Partial<VisibilityConfig>) }
    } catch {
      return DEFAULT_VISIBILITY
    }
  }
}

export function matches(info: ActiveAppInfo, config: VisibilityConfig): boolean {
  const app = info.appName.toLowerCase()
  const includes = (list: string[], value: string): boolean =>
    list.some((entry) => value.includes(entry.toLowerCase()))

  if (includes(config.apps, app)) return true

  const isBrowser = includes(config.browsers, app)
  if (isBrowser) {
    if (info.url && includes(config.domains, info.url.toLowerCase())) return true
    if (info.title && includes(config.titleKeywords, info.title.toLowerCase())) return true
    return false
  }

  // Non-browser app with a title (Windows) — still allow keyword match.
  if (info.title && includes(config.titleKeywords, info.title.toLowerCase())) return true
  return false
}
