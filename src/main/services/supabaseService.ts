import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { AuthResult, AuthState, ClipboardItem } from '@shared/types'
import type { SecureStorageAdapter } from '../platform/types'
import { getEnv } from './env'

const SESSION_KEY = 'supabase.session'

interface StoredSession {
  access_token: string
  refresh_token: string
}

/**
 * Wraps Supabase auth + cloud writes. Sessions are persisted in the OS keychain
 * (via SecureStorage) and restored on launch, so the user stays signed in across
 * restarts. When unconfigured (no .env keys) everything no-ops gracefully.
 */
export class SupabaseService {
  private client: SupabaseClient | null = null
  private user: User | null = null
  private onChange: ((state: AuthState) => void) | null = null

  constructor(private readonly secureStorage: SecureStorageAdapter) {
    const url = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/+$/, '')
    const key = getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
    if (url && key) {
      this.client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        // Electron's Node main process has no global WebSocket; supply one so the
        // (unused) realtime client can initialize. We never open a socket.
        realtime: { transport: WebSocket as unknown as never }
      })
    }
    console.log(
      `[VibeDuck] Supabase ${this.client ? `configured (${url})` : 'NOT configured — check .env'}`
    )
  }

  isConfigured(): boolean {
    return this.client !== null
  }

  onStateChange(cb: (state: AuthState) => void): void {
    this.onChange = cb
  }

  getState(): AuthState {
    return { configured: this.isConfigured(), email: this.user?.email ?? null }
  }

  /** Restores a previously saved session from the keychain, if any. */
  async restore(): Promise<void> {
    if (!this.client) return
    const raw = await this.secureStorage.get(SESSION_KEY)
    if (!raw) return
    try {
      const session = JSON.parse(raw) as StoredSession
      const { data, error } = await this.client.auth.setSession(session)
      if (error) {
        await this.secureStorage.delete(SESSION_KEY)
        return
      }
      this.user = data.user
      this.emit()
    } catch {
      await this.secureStorage.delete(SESSION_KEY)
    }
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    if (!this.client) return { ok: false, error: 'Cloud sync is not configured.' }
    const { data, error } = await this.client.auth.signUp({ email, password })
    if (error) return { ok: false, error: error.message }
    if (data.session) {
      await this.persist(data.session)
      this.user = data.user
      this.emit()
      return { ok: true }
    }
    // Email confirmation required before a session is issued.
    return { ok: true, needsConfirmation: true }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!this.client) return { ok: false, error: 'Cloud sync is not configured.' }
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    if (data.session) await this.persist(data.session)
    this.user = data.user
    this.emit()
    return { ok: true }
  }

  async signOut(): Promise<void> {
    if (this.client) await this.client.auth.signOut().catch(() => undefined)
    await this.secureStorage.delete(SESSION_KEY)
    this.user = null
    this.emit()
  }

  /** Best-effort push of a captured clipboard item to the cloud. No-op when signed out. */
  async pushClipboard(item: ClipboardItem): Promise<void> {
    if (!this.client || !this.user) return
    try {
      await this.client.from('clipboard_items').upsert({
        id: item.id,
        user_id: this.user.id,
        content: item.content,
        category: item.category,
        pinned: item.pinned,
        favorite: item.favorite,
        created_at: item.createdAt,
        updated_at: item.updatedAt
      })
    } catch {
      // Offline or transient error — local SQLite remains the source of truth.
    }
  }

  private async persist(session: { access_token: string; refresh_token: string }): Promise<void> {
    await this.secureStorage.set(
      SESSION_KEY,
      JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })
    )
  }

  private emit(): void {
    this.onChange?.(this.getState())
  }
}
