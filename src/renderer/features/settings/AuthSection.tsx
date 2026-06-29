import { useEffect, useMemo, useState } from 'react'
import type { AuthState } from '@shared/types'
import { ipc } from '../../lib/ipc'

type Mode = 'in' | 'up'
type Feedback = { kind: 'error' | 'success'; text: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Cloud account section: register / sign in with Supabase so copy-paste history
 * and other data can sync across devices. Hidden behind configuration — until
 * Supabase keys are present in `.env`, it shows setup guidance.
 */
export function AuthSection(): JSX.Element {
  const [state, setState] = useState<AuthState>({ configured: false, email: null })
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    void ipc.invoke(ipc.channels.AuthGetState).then(setState)
    return ipc.on(ipc.channels.EvtAuthState, setState)
  }, [])

  const emailValid = EMAIL_RE.test(email.trim())
  const passwordValid = password.length >= 6
  const canSubmit = useMemo(
    () => emailValid && passwordValid && !busy,
    [emailValid, passwordValid, busy]
  )

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    setBusy(true)
    setFeedback(null)
    const result =
      mode === 'in'
        ? await ipc.invoke(ipc.channels.AuthSignIn, email.trim(), password)
        : await ipc.invoke(ipc.channels.AuthSignUp, email.trim(), password)
    setBusy(false)
    if (!result.ok) {
      setFeedback({ kind: 'error', text: result.error ?? 'Something went wrong.' })
      return
    }
    if (result.needsConfirmation) {
      setFeedback({
        kind: 'success',
        text: 'Account created — check your email to confirm, then sign in.'
      })
      setMode('in')
      setPassword('')
      return
    }
    setPassword('')
  }

  const signOut = async (): Promise<void> => {
    await ipc.invoke(ipc.channels.AuthSignOut)
    setFeedback(null)
  }

  return (
    <section className="overflow-hidden rounded-xl bg-duck-panel">
      <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-duck-accent/15 text-base">
          ☁️
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">Cloud account</h2>
          <p className="text-[11px] text-white/40">Back up & sync across devices</p>
        </div>
        {state.configured && state.email && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected
          </span>
        )}
      </div>

      <div className="p-5">
        {!state.configured ? (
          <SetupHint />
        ) : state.email ? (
          <SignedIn email={state.email} onSignOut={signOut} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-duck-shell p-1">
              <TabButton active={mode === 'in'} onClick={() => setMode('in')}>
                Sign in
              </TabButton>
              <TabButton active={mode === 'up'} onClick={() => setMode('up')}>
                Create account
              </TabButton>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-white/60">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2.5 text-sm outline-none transition focus:border-duck-accent focus:ring-2 focus:ring-duck-accent/20"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-xs font-medium text-white/60">
                Password
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[11px] text-white/40 hover:text-white/70"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'up' ? 'At least 6 characters' : '••••••••'}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                className="w-full rounded-lg border border-white/10 bg-duck-shell px-3 py-2.5 text-sm outline-none transition focus:border-duck-accent focus:ring-2 focus:ring-duck-accent/20"
              />
              {mode === 'up' && password.length > 0 && !passwordValid && (
                <span className="text-[11px] text-amber-300/80">
                  Use at least 6 characters.
                </span>
              )}
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-duck-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && <Spinner />}
              {mode === 'in' ? 'Sign in' : 'Create account'}
            </button>

            {feedback && (
              <p
                className={`rounded-lg px-3 py-2 text-xs ${
                  feedback.kind === 'error'
                    ? 'bg-red-500/10 text-red-300'
                    : 'bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {feedback.text}
              </p>
            )}

            <p className="text-center text-[11px] text-white/35">
              {mode === 'in' ? "Don't have an account? " : 'Already registered? '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'in' ? 'up' : 'in')
                  setFeedback(null)
                }}
                className="font-medium text-duck-accent hover:underline"
              >
                {mode === 'in' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </form>
        )}
      </div>
    </section>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md py-1.5 text-xs font-semibold transition ${
        active ? 'bg-duck-accent text-white shadow' : 'text-white/50 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  )
}

function SignedIn({ email, onSignOut }: { email: string; onSignOut: () => void }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-duck-accent/20 text-sm font-bold text-duck-accent">
        {email.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{email}</p>
        <p className="text-[11px] text-white/40">Syncing enabled</p>
      </div>
      <button
        onClick={onSignOut}
        className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
      >
        Sign out
      </button>
    </div>
  )
}

function SetupHint(): JSX.Element {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-duck-shell/50 p-4 text-xs leading-relaxed text-white/50">
      Cloud sync isn&apos;t configured yet. Add{' '}
      <code className="rounded bg-white/10 px-1 text-white/70">SUPABASE_URL</code> and{' '}
      <code className="rounded bg-white/10 px-1 text-white/70">SUPABASE_ANON_KEY</code> to a{' '}
      <code className="rounded bg-white/10 px-1 text-white/70">.env</code> file (see{' '}
      <code className="rounded bg-white/10 px-1 text-white/70">.env.example</code>) and restart the
      app to enable registration &amp; sync.
    </div>
  )
}

function Spinner(): JSX.Element {
  return (
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  )
}
