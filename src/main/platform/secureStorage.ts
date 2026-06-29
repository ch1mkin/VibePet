import { safeStorage } from 'electron'
import type { SecureStorageAdapter } from './types'

/**
 * Secure credential storage backed by the OS keychain.
 *
 * Uses Electron `safeStorage` (DPAPI on Windows, Keychain on macOS) to encrypt
 * values. Encrypted blobs are kept in the local settings repository by the caller;
 * here we expose encrypt/decrypt against an in-memory + injected persistence layer.
 */
export class OsSecureStorage implements SecureStorageAdapter {
  constructor(
    private readonly persist: {
      read(key: string): string | null
      write(key: string, value: string): void
      remove(key: string): void
    }
  ) {}

  async get(key: string): Promise<string | null> {
    const stored = this.persist.read(key)
    if (!stored) return null
    if (!safeStorage.isEncryptionAvailable()) return stored
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'))
    } catch {
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      this.persist.write(key, value)
      return
    }
    const encrypted = safeStorage.encryptString(value).toString('base64')
    this.persist.write(key, encrypted)
  }

  async delete(key: string): Promise<void> {
    this.persist.remove(key)
  }
}
