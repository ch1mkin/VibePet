import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc'

const PERMISSIONS: { name: string; why: string }[] = [
  {
    name: 'Accessibility (macOS) / UI Automation (Windows)',
    why: 'Lets the duck read and rewrite your prompt in the chat box for Prompt Boost.'
  },
  { name: 'Notifications', why: 'Occasional tips and status messages from the duck.' },
  {
    name: 'Network',
    why: 'Talks to OpenRouter (AI) and, if you sign in, Supabase (cloud sync). Nothing else.'
  },
  { name: 'Clipboard', why: 'Saves your copy history locally so you can re-use it.' },
  { name: 'Launch at login (optional)', why: 'Only if you enable auto-start.' }
]

const PRIVACY: string[] = [
  'Everything is stored locally on your device in a private SQLite database by default.',
  'Your clipboard history and prompts never leave your machine unless you sign in to cloud sync.',
  'Your OpenRouter API key is kept in the OS secure storage (Keychain / Credential Vault).',
  'Prompt text is only sent to the AI provider you configured when you ask for a boost or analysis.',
  'No analytics, tracking, or telemetry — we don’t collect usage data.'
]

/** App identity: version, about, privacy policy, and the permissions it uses. */
export function AboutSection(): JSX.Element {
  const [version, setVersion] = useState('—')

  useEffect(() => {
    void ipc
      .invoke(ipc.channels.AppGetVersion)
      .then(setVersion)
      .catch(() => setVersion('—'))
  }, [])

  return (
    <section className="overflow-hidden rounded-xl bg-duck-panel">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-duck-accent/15 text-lg">
          🦆
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">VibeDuck</h2>
          <p className="text-[11px] text-white/40">AI desktop companion for developers</p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/60">
          v{version}
        </span>
      </div>

      <div className="space-y-5 p-5 text-xs leading-relaxed text-white/60">
        <div>
          <p className="mb-1 font-semibold text-white/80">About</p>
          <p>
            VibeDuck is a living desktop pet that hangs out while you code, watches for AI chat
            boxes, and helps you write sharper prompts — all offline-first and privacy-respecting.
          </p>
        </div>

        <div>
          <p className="mb-1 font-semibold text-white/80">About me</p>
          <p>
            Made by Uday. Built with Electron, React &amp; TypeScript. Feedback and ideas are always
            welcome.
          </p>
        </div>

        <div>
          <p className="mb-1 font-semibold text-white/80">Privacy policy</p>
          <ul className="ml-4 list-disc space-y-1">
            {PRIVACY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 font-semibold text-white/80">Permissions used</p>
          <ul className="space-y-2">
            {PERMISSIONS.map((p) => (
              <li key={p.name} className="rounded-lg bg-duck-shell/60 p-3">
                <p className="font-medium text-white/80">{p.name}</p>
                <p className="text-white/50">{p.why}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-white/5 pt-3 text-center text-[11px] text-white/30">
          VibeDuck v{version} · © {new Date().getFullYear()}
        </p>
      </div>
    </section>
  )
}
