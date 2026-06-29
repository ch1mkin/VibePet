import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc'
import { AboutSection } from './AboutSection'
import { AuthSection } from './AuthSection'
import { AtlasSection } from './AtlasSection'
import { GameAssetsSection } from './GameAssetsSection'
import { PetSection } from './PetSection'
import { PromptBoostSection } from './PromptBoostSection'
import { SpritesSection } from './SpritesSection'
import { VisibilitySection } from './VisibilitySection'

const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen-2-7b-instruct:free'
]

export function SettingsApp(): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [model, setModel] = useState(FREE_MODELS[0])
  const [temperature, setTemperature] = useState('0.7')
  const [maxTokens, setMaxTokens] = useState('1024')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      setHasKey(await ipc.invoke(ipc.channels.AIHasApiKey))
      const m = await ipc.invoke(ipc.channels.SettingsGet, 'openrouter.model')
      const t = await ipc.invoke(ipc.channels.SettingsGet, 'openrouter.temperature')
      const mt = await ipc.invoke(ipc.channels.SettingsGet, 'openrouter.maxTokens')
      if (m) setModel(m)
      if (t) setTemperature(t)
      if (mt) setMaxTokens(mt)
    })()
  }, [])

  const save = async (): Promise<void> => {
    if (apiKey.trim()) {
      await ipc.invoke(ipc.channels.AISaveApiKey, apiKey.trim())
      setHasKey(true)
      setApiKey('')
    }
    await ipc.invoke(ipc.channels.SettingsSet, 'openrouter.model', model)
    await ipc.invoke(ipc.channels.SettingsSet, 'openrouter.temperature', temperature)
    await ipc.invoke(ipc.channels.SettingsSet, 'openrouter.maxTokens', maxTokens)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="min-h-screen bg-duck-shell p-8 text-white">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-xl font-semibold">🦆 VibeDuck Settings</h1>

        <PetSection />

        <section className="space-y-4 rounded-xl bg-duck-panel p-5">
          <h2 className="text-sm font-semibold text-duck-accent">OpenRouter</h2>

          <Field label={`API Key ${hasKey ? '(saved — leave blank to keep)' : ''}`}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? '••••••••••••' : 'sk-or-…'}
              className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2 text-sm outline-none focus:border-duck-accent"
            />
          </Field>

          <Field label="Model">
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="openrouter-models"
              placeholder="e.g. google/gemma-3-27b-it:free"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2 text-sm outline-none focus:border-duck-accent"
            />
            <datalist id="openrouter-models">
              {FREE_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <span className="mt-1 block text-[11px] text-white/40">
              Type any OpenRouter model id (see{' '}
              <a
                href="https://openrouter.ai/models"
                className="text-duck-accent hover:underline"
              >
                openrouter.ai/models
              </a>
              ). Suggestions are just shortcuts.
            </span>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Temperature">
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2 text-sm outline-none focus:border-duck-accent"
              />
            </Field>
            <Field label="Max Tokens">
              <input
                type="number"
                step="64"
                min="64"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2 text-sm outline-none focus:border-duck-accent"
              />
            </Field>
          </div>
        </section>

        <button
          onClick={save}
          className="rounded-lg bg-duck-accent px-4 py-2 text-sm font-semibold"
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>

        <PromptBoostSection />

        <AuthSection />

        <VisibilitySection />

        <AtlasSection />

        <SpritesSection />

        <GameAssetsSection />

        <AboutSection />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-white/60">{label}</span>
      {children}
    </label>
  )
}
