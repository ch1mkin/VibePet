import { useEffect, useState } from 'react'
import type { VisibilityConfig } from '@shared/types'
import { ipc } from '../../lib/ipc'

/** Controls when the duck appears (only on coding / AI apps by default). */
export function VisibilitySection(): JSX.Element {
  const [config, setConfig] = useState<VisibilityConfig | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void ipc.invoke(ipc.channels.VisibilityGet).then(setConfig)
  }, [])

  if (!config) return <p className="text-xs text-white/50">Loading…</p>

  const update = (patch: Partial<VisibilityConfig>): void => setConfig({ ...config, ...patch })

  const save = async (): Promise<void> => {
    await ipc.invoke(ipc.channels.VisibilitySet, config)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <section className="space-y-4 rounded-xl bg-duck-panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-duck-accent">When to show the duck</h2>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          Only on coding &amp; AI apps
        </label>
      </div>

      <p className="text-xs text-white/50">
        When enabled, the duck only appears while one of these apps is focused. Disable to always
        show it. (macOS may ask for permission to read your browser tab the first time.)
      </p>

      <ListField
        label="Apps (editors, terminals, AI desktop apps)"
        value={config.apps}
        disabled={!config.enabled}
        onChange={(apps) => update({ apps })}
      />
      <ListField
        label="Browsers (checked against AI sites below)"
        value={config.browsers}
        disabled={!config.enabled}
        onChange={(browsers) => update({ browsers })}
      />
      <ListField
        label="AI site domains"
        value={config.domains}
        disabled={!config.enabled}
        onChange={(domains) => update({ domains })}
      />
      <ListField
        label="Window-title keywords"
        value={config.titleKeywords}
        disabled={!config.enabled}
        onChange={(titleKeywords) => update({ titleKeywords })}
      />

      <button onClick={save} className="rounded-lg bg-duck-accent px-4 py-2 text-sm font-semibold">
        {saved ? 'Saved ✓' : 'Save visibility'}
      </button>
    </section>
  )
}

function ListField(props: {
  label: string
  value: string[]
  disabled?: boolean
  onChange: (value: string[]) => void
}): JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-white/60">{props.label}</span>
      <input
        type="text"
        disabled={props.disabled}
        value={props.value.join(', ')}
        onChange={(e) =>
          props.onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
        className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2 text-xs outline-none focus:border-duck-accent disabled:opacity-40"
      />
    </label>
  )
}
