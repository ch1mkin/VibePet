import { createActiveAppAdapter } from './activeApp'
import {
  ElectronAutoStart,
  ElectronClipboard,
  ElectronGlobalShortcut,
  ElectronNotifications,
  NodeFileWatcher
} from './electronAdapters'
import { OsSecureStorage } from './secureStorage'
import type { PlatformServices } from './types'

export * from './types'
export * from './activeApp'

interface KeyValuePersistence {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}

/**
 * Factory that assembles platform services. Today every OS uses the Electron-native
 * adapters; when a platform needs divergent behavior, swap the implementation here
 * without touching any caller.
 */
export function createPlatformServices(persistence: KeyValuePersistence): PlatformServices {
  return {
    clipboard: new ElectronClipboard(),
    notifications: new ElectronNotifications(),
    autoStart: new ElectronAutoStart(),
    shortcuts: new ElectronGlobalShortcut(),
    secureStorage: new OsSecureStorage(persistence),
    fileWatcher: new NodeFileWatcher(),
    activeApp: createActiveAppAdapter()
  }
}
