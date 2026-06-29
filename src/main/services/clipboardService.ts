import type { ClipboardCategory, ClipboardItem } from '@shared/types'
import type { ClipboardAdapter } from '../platform'
import type { ClipboardRepository } from '../database/repositories/clipboardRepository'

/**
 * Watches the OS clipboard, categorizes captured text, persists it locally, and
 * notifies subscribers (e.g. to update the UI and trigger a duck celebration).
 */
export class ClipboardService {
  private stop: (() => void) | null = null

  constructor(
    private readonly clipboard: ClipboardAdapter,
    private readonly repo: ClipboardRepository
  ) {}

  start(onCaptured: (item: ClipboardItem) => void): void {
    if (this.stop) return
    this.stop = this.clipboard.watch((capture) => {
      const item =
        capture.kind === 'image'
          ? this.repo.save({ content: capture.dataUrl, category: 'image' })
          : this.repo.save({ content: capture.text, category: categorize(capture.text) })
      onCaptured(item)
    })
  }

  /** Put a stored item back onto the OS clipboard (text or image). */
  copy(content: string, category: ClipboardCategory): void {
    if (category === 'image') this.clipboard.writeImageDataUrl(content)
    else this.clipboard.writeText(content)
  }

  dispose(): void {
    this.stop?.()
    this.stop = null
  }
}

const URL_RE = /^https?:\/\/\S+$/i
const COMMAND_RE = /^(?:\$\s*)?(?:npm|pnpm|yarn|git|cd|ls|sudo|docker|kubectl|brew|pip|cargo|go)\b/m
const CODE_HINTS = /[{};()=>]|function |const |import |class |def |=>/

export function categorize(text: string): ClipboardCategory {
  const trimmed = text.trim()
  if (URL_RE.test(trimmed)) return 'url'
  if (COMMAND_RE.test(trimmed) && trimmed.split('\n').length <= 3) return 'command'
  if (CODE_HINTS.test(trimmed)) return 'code'
  if (trimmed.length > 200 && /\b(please|generate|write|explain|create)\b/i.test(trimmed)) {
    return 'prompt'
  }
  return 'text'
}
