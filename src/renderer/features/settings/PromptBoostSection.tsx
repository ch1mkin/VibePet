import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc'

/**
 * Toggle for Prompt Boost: when on, the duck watches your AI chat box, shows
 * what you're typing, and (on ⌘/Ctrl+Enter) rewrites the prompt for best results
 * before you send it.
 */
export function PromptBoostSection(): JSX.Element {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    void ipc.invoke(ipc.channels.PromptBoostGet).then((s) => setEnabled(s.enabled))
    return ipc.on(ipc.channels.EvtPromptBoost, (s) => setEnabled(s.enabled))
  }, [])

  const toggle = async (): Promise<void> => {
    const next = !enabled
    setEnabled(next)
    await ipc.invoke(ipc.channels.PromptBoostSet, next)
  }

  return (
    <section className="overflow-hidden rounded-xl bg-duck-panel">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-duck-accent/15 text-base">
          ✨
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">Prompt Boost</h2>
          <p className="text-[11px] text-white/40">Auto-improve prompts before they&apos;re sent</p>
        </div>
        <Toggle on={enabled} onClick={toggle} />
      </div>

      <div className="space-y-3 p-5 text-xs leading-relaxed text-white/55">
        <p>When enabled, while you type in an AI chat box (Cursor, ChatGPT, Claude, …):</p>
        <ol className="ml-4 list-decimal space-y-1.5">
          <li>The duck shows what you&apos;re typing in a bubble above its head.</li>
          <li>
            Press{' '}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80">
              ⌘/Ctrl + Enter
            </kbd>{' '}
            — the duck rewrites your prompt and drops it back into the box.
          </li>
          <li>
            Press{' '}
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80">
              ⌘/Ctrl + Enter
            </kbd>{' '}
            again to send the improved prompt.
          </li>
        </ol>
        <p className="rounded-lg bg-duck-shell/60 p-3 text-[11px] text-white/45">
          Needs an OpenRouter API key (above) and, on macOS, Accessibility permission for VibeDuck
          (System Settings → Privacy &amp; Security → Accessibility) so it can read &amp; edit the
          chat box.
        </p>
      </div>
    </section>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        on ? 'bg-duck-accent' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
