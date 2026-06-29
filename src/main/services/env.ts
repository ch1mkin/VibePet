import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** Minimal KEY=VALUE parser (no dependency on dotenv). */
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

let cached: Record<string, string> | null = null

/**
 * Reads variables from the project's `.env` file at runtime. The main process
 * runs in Node, so this is more reliable than build-time injection across the
 * electron-vite dev/build pipelines. Checks the most likely locations for both
 * dev (project root) and packaged builds (resources dir).
 */
export function readEnvFile(): Record<string, string> {
  if (cached) return cached
  const candidates = [
    join(app.getAppPath(), '.env'),
    join(process.cwd(), '.env'),
    process.resourcesPath ? join(process.resourcesPath, '.env') : ''
  ].filter(Boolean)

  for (const file of candidates) {
    try {
      if (existsSync(file)) {
        cached = parseEnv(readFileSync(file, 'utf8'))
        return cached
      }
    } catch {
      // try the next candidate
    }
  }
  cached = {}
  return cached
}

/** Resolves a variable from the real environment first, then the `.env` file. */
export function getEnv(...keys: string[]): string {
  const file = readEnvFile()
  for (const key of keys) {
    const value = process.env[key] ?? file[key]
    if (value) return value
  }
  return ''
}
