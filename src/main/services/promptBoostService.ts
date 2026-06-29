import { systemPreferences } from 'electron'
import { IPC } from '@shared/ipc-contract'
import type { AIService } from './aiService'
import type { ActiveAppAdapter } from '../platform/activeApp'
import type { GlobalShortcutAdapter } from '../platform'
import type { SettingsRepository } from '../database/repositories/settingsRepository'
import type { WindowManager } from '../windows/windowManager'

const SETTINGS_KEY = 'duck.promptBoost'
/** Safe trigger: AI chat boxes don't use ⌘/Ctrl+Enter to send, so we can claim it. */
const ACCEL = 'CommandOrControl+Enter'
/** After this long the "armed to send" state expires and the next press re-boosts. */
const ARM_TIMEOUT_MS = 30_000
/** How long the "copied & added" summary lingers above the duck before it vanishes. */
const RESULT_MS = 4500

/** Condense the improved prompt into a short, single-line summary for the bubble. */
function summarize(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  const MAX = 64
  if (oneLine.length <= MAX) return oneLine
  const cut = oneLine.slice(0, MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

/**
 * Prompt Boost — a toggleable two-stage flow over the user's AI chat box:
 *
 *   1. User types a prompt, then presses ⌘/Ctrl+Enter → the duck rewrites it for
 *      best results and pastes the improved version back into the box.
 *   2. Pressing ⌘/Ctrl+Enter again submits it (simulated Return).
 *
 * Rewriting + submitting use OS automation (macOS Accessibility today); when
 * that's unavailable the duck explains what's missing instead of failing silently.
 */
export class PromptBoostService {
  private enabled = false
  private armed = false
  private armedAt = 0
  private busy = false
  /** While > now, PromptWatch must not overwrite the boost's own draft bubble. */
  private draftHold = 0
  private draftTimer: ReturnType<typeof setTimeout> | null = null
  /** Throttle the "it's off, enable it" hint so it doesn't spam on every press. */
  private lastDisabledHintAt = 0

  constructor(
    private readonly settings: SettingsRepository,
    private readonly activeApp: ActiveAppAdapter,
    private readonly ai: AIService,
    private readonly windows: WindowManager,
    private readonly shortcuts: GlobalShortcutAdapter
  ) {}

  init(): void {
    this.enabled = this.settings.get(SETTINGS_KEY) === '1'
    // Always claim the shortcut so we can nudge the user to turn the feature on
    // when they try it while it's off. (AI chat boxes submit with Enter, not
    // ⌘/Ctrl+Enter, so claiming this combo doesn't block sending.)
    this.registerShortcut()
  }

  /**
   * On macOS, reading & editing another app's text field needs Accessibility
   * permission. Calling this with `true` shows the system prompt the first time.
   */
  private ensureAccessibility(): void {
    if (process.platform !== 'darwin') return
    try {
      const trusted = systemPreferences.isTrustedAccessibilityClient(true)
      if (!trusted) {
        this.say('enable VibeDuck in System Settings → Accessibility, then retry', 'tip')
      }
    } catch {
      /* not available on this platform */
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  getState(): { enabled: boolean } {
    return { enabled: this.enabled }
  }

  setEnabled(enabled: boolean): { enabled: boolean } {
    this.enabled = enabled
    this.settings.set(SETTINGS_KEY, enabled ? '1' : '0')
    // Keep the shortcut registered either way (see init): when off it shows the
    // "enable it in Settings" hint instead of boosting.
    this.registerShortcut()
    if (enabled) this.ensureAccessibility()
    this.armed = false
    this.windows.broadcast(IPC.EvtPromptBoost, { enabled })
    return { enabled }
  }

  private registerShortcut(): void {
    // Idempotent: drop any prior binding before (re)claiming the accelerator.
    this.shortcuts.unregister(ACCEL)
    this.shortcuts.register(ACCEL, () => void this.trigger())
  }

  /** Invoked by the global shortcut (and the duck context menu). */
  async trigger(): Promise<void> {
    if (this.busy) return
    if (!this.enabled) {
      // The user reached for Prompt Boost but it's switched off — nudge them.
      const now = Date.now()
      if (now - this.lastDisabledHintAt > 8000) {
        this.lastDisabledHintAt = now
        this.react('confused')
        this.say('Prompt Boost is off — turn it on in Settings ⚙️', 'tip')
      }
      return
    }

    // Stage 2: a freshly-boosted prompt is waiting — send it.
    if (this.armed && Date.now() - this.armedAt < ARM_TIMEOUT_MS) {
      this.armed = false
      const ok = await this.activeApp.submitFocused()
      this.react(ok ? 'celebrating' : 'confused')
      this.say(
        ok ? 'sent! 🚀' : "couldn't press Enter — grant Accessibility access",
        ok ? 'happy' : 'tip'
      )
      return
    }

    // Stage 1: grab the prompt the user typed, improve it, paste it back + copy.
    this.busy = true
    try {
      // Select-all + copy works even in apps that hide AXValue (ChatGPT web,
      // Cursor); fall back to the AXValue read only if that's unavailable.
      let text = (await this.activeApp.captureFocusedText())?.trim() ?? ''
      if (!text) {
        const field = await this.activeApp.getFocusedField()
        text = (field?.text ?? '').trim()
      }
      if (!text) {
        this.say('type a prompt first, then press ⌘↵', 'tip')
        return
      }

      // Temporary status above the duck while the AI works. Hold the bubble so
      // PromptWatch's live mirror doesn't wipe it mid-thought.
      this.showDraft('💭 thinking a better prompt…', 60_000)
      this.react('thinking')

      let improved: string
      try {
        improved = await this.ai.improvePrompt(text)
      } catch (err) {
        this.clearDraft()
        const missingKey = err instanceof Error && /api key/i.test(err.message)
        this.say(
          missingKey ? 'add an OpenRouter API key in Settings first' : "couldn't reach the AI",
          'tip'
        )
        return
      }

      // `pasteText` puts the improved prompt on the clipboard (so the user can
      // paste it anywhere) and tries to drop it straight into the chat box.
      const pasted = await this.activeApp.pasteText(improved)
      this.react('happy')

      // Show a short summary that the full prompt was copied + added, then let
      // the bubble disappear on its own.
      this.showDraft(`✓ copied & added:\n"${summarize(improved)}"`, RESULT_MS + 600)
      if (pasted) {
        this.armed = true
        this.armedAt = Date.now()
      }
      this.clearDraftAfter(RESULT_MS, () => {
        this.say(
          pasted ? '⌘↵ to send · ⌘V to paste 🚀' : 'paste it with ⌘V ✨',
          'happy'
        )
      })
    } finally {
      this.busy = false
    }
  }

  /** True while the boost owns the draft bubble (PromptWatch should stand down). */
  holdsDraft(): boolean {
    return Date.now() < this.draftHold
  }

  private showDraft(text: string, holdMs: number): void {
    this.draftHold = Date.now() + holdMs
    this.windows.broadcast(IPC.EvtDuckDraft, { text })
  }

  private clearDraft(): void {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer)
      this.draftTimer = null
    }
    this.draftHold = 0
    this.windows.broadcast(IPC.EvtDuckDraft, { text: '' })
  }

  private clearDraftAfter(ms: number, then?: () => void): void {
    if (this.draftTimer) clearTimeout(this.draftTimer)
    this.draftTimer = setTimeout(() => {
      this.draftTimer = null
      this.draftHold = 0
      this.windows.broadcast(IPC.EvtDuckDraft, { text: '' })
      then?.()
    }, ms)
  }

  private react(behavior: string): void {
    this.windows.broadcast(IPC.EvtDuckBehavior, { behavior })
  }

  private say(text: string, tone: 'info' | 'happy' | 'tip'): void {
    this.windows.broadcast(IPC.EvtDuckSay, { text, tone })
  }
}
