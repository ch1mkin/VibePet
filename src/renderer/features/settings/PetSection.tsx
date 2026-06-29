import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc'

/** Name your duck. Stored on the local DuckProfile and synced like everything else. */
export function PetSection(): JSX.Element {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void ipc.invoke(ipc.channels.DuckGetProfile).then((p) => setName(p.name))
  }, [])

  const save = async (): Promise<void> => {
    const trimmed = name.trim() || 'Duck'
    await ipc.invoke(ipc.channels.DuckSaveProfile, { name: trimmed })
    setName(trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <section className="space-y-4 rounded-xl bg-duck-panel p-5">
      <h2 className="text-sm font-semibold text-duck-accent">Your pet</h2>

      <label className="block space-y-1">
        <span className="text-xs text-white/60">Name</span>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
            maxLength={24}
            placeholder="e.g. Quackers"
            className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2 text-sm outline-none focus:border-duck-accent"
          />
          <button
            onClick={save}
            className="shrink-0 rounded-lg bg-duck-accent px-4 py-2 text-sm font-semibold"
          >
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </label>
    </section>
  )
}
