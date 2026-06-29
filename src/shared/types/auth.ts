/** Cloud account state surfaced to the UI. */
export interface AuthState {
  /** True when Supabase credentials are present in the build (.env). */
  configured: boolean
  /** Signed-in user's email, or null when signed out. */
  email: string | null
}

export interface AuthResult {
  ok: boolean
  /** Whether the action needs the user to confirm via email (sign-up). */
  needsConfirmation?: boolean
  error?: string
}
