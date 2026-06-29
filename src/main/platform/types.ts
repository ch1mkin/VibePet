/**
 * Unified, OS-agnostic platform interfaces.
 *
 * Concrete implementations live in ./windows.ts (electron-native, cross-platform)
 * and may be specialized per OS in ./darwin and ./win32 when behavior diverges.
 * App/business logic must depend on these interfaces only.
 */
import type { ActiveAppAdapter } from './activeApp'

/** A single clipboard change — either plain text or an image (as a data URL). */
export type ClipboardCapture =
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUrl: string }

export interface ClipboardAdapter {
  readText(): string
  writeText(text: string): void
  /** Write a PNG/JPEG data URL back to the OS clipboard as an image. */
  writeImageDataUrl(dataUrl: string): void
  /** Begin polling the OS clipboard; invokes `onChange` when content changes. */
  watch(onChange: (capture: ClipboardCapture) => void): () => void
}

export interface NotificationAdapter {
  notify(title: string, body: string): void
}

export interface AutoStartAdapter {
  isEnabled(): boolean
  setEnabled(enabled: boolean): void
}

export interface GlobalShortcutAdapter {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
  unregisterAll(): void
}

export interface SecureStorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

export interface FileWatcherAdapter {
  watch(path: string, onChange: (path: string) => void): () => void
}

export interface PlatformServices {
  clipboard: ClipboardAdapter
  notifications: NotificationAdapter
  autoStart: AutoStartAdapter
  shortcuts: GlobalShortcutAdapter
  secureStorage: SecureStorageAdapter
  fileWatcher: FileWatcherAdapter
  activeApp: ActiveAppAdapter
}
