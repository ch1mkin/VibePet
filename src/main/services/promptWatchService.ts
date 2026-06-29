import { screen } from 'electron'
import { IPC } from '@shared/ipc-contract'
import { assessPrompt } from '@shared/utils'
import type { VisibilityConfig } from '@shared/types'
import type { ActiveAppAdapter, ActiveAppInfo } from '../platform/activeApp'
import type { DuckMotionService } from './duckMotionService'
import type { PromptBoostService } from './promptBoostService'
import type { WindowManager } from '../windows/windowManager'

const POLL_MS = 1300
/** Faster cadence while Prompt Boost mirrors what you're typing. */
const FAST_POLL_MS = 450
const MIN_PROMPT_LEN = 6

/** Editor/AI desktop apps whose focused field is worth peeking at. */
const PROMPT_APPS = ['cursor', 'claude', 'windsurf', 'code', 'visual studio code', 'zed']

/**
 * Watches for the user typing into an AI prompt surface (Cursor's AI box,
 * ChatGPT, Claude, Gemini, …). When detected, it walks the duck over to the
 * chat box and gives live, local (no-API) feedback on the prompt's quality.
 *
 * Reading the focused field uses macOS Accessibility (best-effort); if that's
 * unavailable the duck still walks toward the likely chat area and waits.
 */
export class PromptWatchService {
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = true
  private lastSeen = ''
  private lastAssessed = ''
  private wasAi = false
  private lastCursorX = 0
  private lastCursorY = 0
  private lastDraft = ''

  constructor(
    private readonly activeApp: ActiveAppAdapter,
    private readonly motion: DuckMotionService,
    private readonly windows: WindowManager,
    private readonly getConfig: () => VisibilityConfig,
    private readonly promptBoost: PromptBoostService
  ) {}

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.schedule(POLL_MS)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  /** Self-scheduling loop so we can speed up while Prompt Boost is active. */
  private schedule(delay: number): void {
    this.timer = setTimeout(async () => {
      if (this.stopped) return
      let next = POLL_MS
      try {
        next = await this.tick()
      } catch {
        next = POLL_MS
      }
      this.schedule(next)
    }, delay)
  }

  private reset(): void {
    this.motion.setPromptWatch(null)
    this.lastSeen = ''
    this.lastAssessed = ''
    this.wasAi = false
    this.setDraft('')
  }

  /** Mirror what the user is typing into a "texting" bubble above the duck. */
  private setDraft(text: string): void {
    if (text === this.lastDraft) return
    this.lastDraft = text
    this.windows.broadcast(IPC.EvtDuckDraft, { text })
  }

  /** Runs one poll and returns how long to wait before the next one. */
  private async tick(): Promise<number> {
    const duck = this.windows.getDuckWindow()
    if (!duck || duck.isDestroyed() || !duck.isVisible() || this.motion.isSitting()) {
      this.reset()
      return POLL_MS
    }

    const info = await this.activeApp.getActive()
    if (!info || !isPromptContext(info, this.getConfig())) {
      this.reset()
      return POLL_MS
    }

    if (!this.wasAi) {
      this.wasAi = true
      this.windows.broadcast(IPC.EvtDuckSay, { text: 'let me peek at your prompt 👀', tone: 'tip' })
    }

    const boost = this.promptBoost.isEnabled()
    const field = await this.activeApp.getFocusedField()
    if (field && field.w > 0 && field.h > 0) {
      // Perch at the top-right corner of the input box.
      this.motion.setPromptWatch({ x: field.x + field.w - 24, y: field.y - 4 })
      const raw = field.text ?? ''
      const text = raw.trim()
      if (boost) {
        // Prompt Boost owns the conversation: show the live draft + "coding",
        // but stay quiet on quality tips (the user will press ⌘↵ to boost).
        // While the boost is showing its own bubble (thinking / copied), don't
        // overwrite it with the live mirror.
        if (!this.promptBoost.holdsDraft()) this.setDraft(raw)
        if (text !== this.lastSeen) {
          this.lastSeen = text
          if (text.length > 0) this.windows.broadcast(IPC.EvtDuckBehavior, { behavior: 'coding' })
        }
        return FAST_POLL_MS
      }
      if (text.length > 0) {
        // Accessibility exposes the live text → give precise feedback.
        this.evaluate(text)
      } else {
        // No readable text → fall back to the keyboard-vs-mouse heuristic.
        this.signalTypingByActivity()
      }
      return POLL_MS
    }

    // Couldn't locate the field — approach the usual chat area (bottom-center)
    // and infer typing from input activity.
    if (!this.promptBoost.holdsDraft()) this.setDraft('')
    const { workArea } = screen.getPrimaryDisplay()
    this.motion.setPromptWatch({
      x: workArea.x + workArea.width / 2,
      y: workArea.y + workArea.height - 150
    })
    this.signalTypingByActivity()
    // Poll a bit faster in boost mode so the duck reacts quickly once the field
    // becomes readable again.
    return boost ? FAST_POLL_MS : POLL_MS
  }

  /**
   * When the focused text isn't readable (browsers, Electron editors that don't
   * expose AXValue) we approximate "is the user typing?" by watching the mouse:
   * if the cursor is sitting still while an AI/editor app is focused, they're
   * almost certainly at the keyboard → play the "coding" animation.
   */
  private signalTypingByActivity(): void {
    const { x, y } = screen.getCursorScreenPoint()
    const moved = Math.abs(x - this.lastCursorX) > 2 || Math.abs(y - this.lastCursorY) > 2
    this.lastCursorX = x
    this.lastCursorY = y
    if (!moved) this.windows.broadcast(IPC.EvtDuckBehavior, { behavior: 'coding' })
  }

  /**
   * While the user is actively typing → play the "coding" animation. Once they
   * pause (text stable for a poll) → assess the prompt and react to its quality.
   */
  private evaluate(raw: string): void {
    const text = raw.trim()

    // Text changed since last poll → they're still typing.
    if (text !== this.lastSeen) {
      this.lastSeen = text
      if (text.length > 0) this.windows.broadcast(IPC.EvtDuckBehavior, { behavior: 'coding' })
      return
    }

    // Stable now — give quality feedback once per distinct prompt.
    if (text.length < MIN_PROMPT_LEN || text === this.lastAssessed) return
    this.lastAssessed = text
    const { level, tip } = assessPrompt(text)
    const behavior = level === 'weak' ? 'confused' : level === 'good' ? 'happy' : 'thinking'
    const tone = level === 'weak' ? 'tip' : level === 'good' ? 'happy' : 'info'
    this.windows.broadcast(IPC.EvtDuckBehavior, { behavior })
    this.windows.broadcast(IPC.EvtDuckSay, { text: tip, tone })
  }
}

function isPromptContext(info: ActiveAppInfo, config: VisibilityConfig): boolean {
  const app = info.appName.toLowerCase()
  const includes = (list: string[], value: string): boolean =>
    list.some((entry) => value.includes(entry.toLowerCase()))

  if (PROMPT_APPS.some((name) => app.includes(name))) return true

  const isBrowser = includes(config.browsers, app)
  if (isBrowser) {
    if (info.url && includes(config.domains, info.url.toLowerCase())) return true
    if (info.title && includes(config.titleKeywords, info.title.toLowerCase())) return true
  }
  return false
}
