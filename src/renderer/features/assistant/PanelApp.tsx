import { useEffect, useState } from 'react'
import type { ClipboardItem, PromptCoachResult } from '@shared/types'
import { ipc } from '../../lib/ipc'

type QuickAction = {
  id: string
  label: string
  build: (input: string) => string
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'explain', label: 'Explain Code', build: (i) => `Explain this code clearly:\n\n${i}` },
  { id: 'tests', label: 'Generate Tests', build: (i) => `Write thorough unit tests for:\n\n${i}` },
  { id: 'optimize', label: 'Optimize', build: (i) => `Optimize this code for performance and readability:\n\n${i}` },
  { id: 'bug', label: 'Find Bug', build: (i) => `Find and explain bugs in this code:\n\n${i}` }
]

export function PanelApp(): JSX.Element {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [coach, setCoach] = useState<PromptCoachResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (build: (i: string) => string): Promise<void> => {
    if (!input.trim()) return
    setBusy(true)
    setError(null)
    setCoach(null)
    setOutput('')
    try {
      const result = await ipc.invoke(ipc.channels.AIComplete, {
        messages: [{ role: 'user', content: build(input) }]
      })
      setOutput(result)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  const improvePrompt = async (): Promise<void> => {
    if (!input.trim()) return
    setBusy(true)
    setError(null)
    setOutput('')
    try {
      setCoach(await ipc.invoke(ipc.channels.AIPromptCoach, input))
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-duck-shell text-white">
      <header className="app-drag flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">🦆 VibeDuck Assistant</span>
        <span className="app-no-drag flex items-center gap-1">
          <button
            className="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/10"
            onClick={() => ipc.invoke(ipc.channels.SettingsOpen)}
          >
            Settings
          </button>
          <button
            className="rounded px-2 py-1 text-xs text-white/60 hover:bg-white/10"
            onClick={() => ipc.invoke(ipc.channels.PanelToggle)}
          >
            Close
          </button>
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a prompt or code snippet…"
          className="min-h-[220px] w-full resize-y rounded-lg border border-white/10 bg-duck-panel p-3 text-sm leading-relaxed outline-none focus:border-duck-accent"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={improvePrompt}
            disabled={busy}
            className="rounded-lg bg-duck-accent px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            Improve Prompt
          </button>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => run(action.build)}
              disabled={busy}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>

        {busy && <p className="text-xs text-white/50">Duck is thinking…</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {coach && <CoachResult result={coach} />}

        {output && (
          <pre className="whitespace-pre-wrap rounded-lg bg-duck-panel p-3 text-xs leading-relaxed">
            {output}
          </pre>
        )}

        <ClipboardHistory onUse={(text) => setInput(text)} />
      </div>
    </div>
  )
}

function ClipboardHistory({ onUse }: { onUse: (text: string) => void }): JSX.Element {
  const [items, setItems] = useState<ClipboardItem[]>([])

  useEffect(() => {
    void ipc.invoke(ipc.channels.ClipboardList).then(setItems).catch(() => setItems([]))
    return ipc.on(ipc.channels.EvtClipboardCaptured, (item) => {
      setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 50))
    })
  }, [])

  return (
    <div className="mt-1">
      <p className="mb-2 text-xs font-semibold text-duck-accent">Clipboard history</p>
      {items.length === 0 ? (
        <p className="text-xs text-white/40">Copied text and images will show up here.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <ClipboardRow key={item.id} item={item} onUse={onUse} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ClipboardRow({
  item,
  onUse
}: {
  item: ClipboardItem
  onUse: (text: string) => void
}): JSX.Element {
  const [copied, setCopied] = useState(false)
  const isImage = item.category === 'image'

  const copy = async (): Promise<void> => {
    await ipc.invoke(ipc.channels.ClipboardCopy, item.content, item.category)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <li className="group flex items-center gap-2 rounded-lg bg-duck-panel p-2">
      {isImage ? (
        <img
          src={item.content}
          alt="clipboard"
          className="h-10 w-10 shrink-0 rounded border border-white/10 object-cover"
        />
      ) : (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/50">
          {item.category}
        </span>
      )}

      <span className="min-w-0 flex-1 truncate text-xs text-white/80">
        {isImage ? 'Image' : item.content.replace(/\s+/g, ' ').trim()}
      </span>

      {!isImage && (
        <button
          onClick={() => onUse(item.content)}
          className="rounded px-2 py-1 text-[10px] text-white/50 opacity-0 hover:bg-white/10 group-hover:opacity-100"
          title="Send to prompt box"
        >
          Use
        </button>
      )}
      <button
        onClick={copy}
        className="rounded bg-duck-accent/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-duck-accent"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </li>
  )
}

function CoachResult({ result }: { result: PromptCoachResult }): JSX.Element {
  return (
    <div className="space-y-3 rounded-lg bg-duck-panel p-3 text-xs">
      <ScoreBar label="Overall" value={result.score.overall} />
      <Section title="Improved Prompt">
        <pre className="whitespace-pre-wrap text-white/90">{result.improvedPrompt}</pre>
      </Section>
      {result.missingContext.length > 0 && (
        <Section title="Missing Context">
          <ul className="list-disc pl-4 text-white/80">
            {result.missingContext.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}
      {result.outputFormat && (
        <Section title="Suggested Output Format">
          <p className="text-white/80">{result.outputFormat}</p>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="mb-1 font-semibold text-duck-accent">{title}</p>
      {children}
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold">{value}/100</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div className="h-full rounded-full bg-duck-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}
