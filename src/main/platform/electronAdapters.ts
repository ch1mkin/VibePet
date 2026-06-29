import { watch as fsWatch } from 'node:fs'
import { app, clipboard, globalShortcut, nativeImage, Notification } from 'electron'
import type {
  AutoStartAdapter,
  ClipboardAdapter,
  ClipboardCapture,
  FileWatcherAdapter,
  GlobalShortcutAdapter,
  NotificationAdapter
} from './types'

const CLIPBOARD_POLL_MS = 800

/**
 * Cross-platform implementations built on Electron's native modules.
 * These cover Windows and macOS uniformly; OS-specific overrides can extend them.
 */

export class ElectronClipboard implements ClipboardAdapter {
  readText(): string {
    return clipboard.readText()
  }

  writeText(text: string): void {
    clipboard.writeText(text)
  }

  writeImageDataUrl(dataUrl: string): void {
    const image = nativeImage.createFromDataURL(dataUrl)
    if (!image.isEmpty()) clipboard.writeImage(image)
  }

  watch(onChange: (capture: ClipboardCapture) => void): () => void {
    let lastText = clipboard.readText()
    let lastImage = imageDataUrl()
    const timer = setInterval(() => {
      // Images take priority: copying a picture usually clears/ignores text.
      const image = imageDataUrl()
      if (image && image !== lastImage) {
        lastImage = image
        onChange({ kind: 'image', dataUrl: image })
        return
      }
      if (!image) lastImage = ''

      const text = clipboard.readText()
      if (text && text !== lastText) {
        lastText = text
        onChange({ kind: 'text', text })
      }
    }, CLIPBOARD_POLL_MS)
    return () => clearInterval(timer)
  }
}

/** Current clipboard image as a PNG data URL, or '' when there's no image. */
function imageDataUrl(): string {
  const image = clipboard.readImage()
  return image.isEmpty() ? '' : image.toDataURL()
}

export class ElectronNotifications implements NotificationAdapter {
  notify(title: string, body: string): void {
    if (!Notification.isSupported()) return
    new Notification({ title, body, silent: true }).show()
  }
}

export class ElectronAutoStart implements AutoStartAdapter {
  isEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin
  }

  setEnabled(enabled: boolean): void {
    app.setLoginItemSettings({ openAtLogin: enabled })
  }
}

export class ElectronGlobalShortcut implements GlobalShortcutAdapter {
  register(accelerator: string, callback: () => void): boolean {
    return globalShortcut.register(accelerator, callback)
  }

  unregister(accelerator: string): void {
    globalShortcut.unregister(accelerator)
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}

export class NodeFileWatcher implements FileWatcherAdapter {
  watch(path: string, onChange: (path: string) => void): () => void {
    const watcher = fsWatch(path, { recursive: true }, (_event, filename) => {
      if (filename) onChange(filename.toString())
    })
    return () => watcher.close()
  }
}
