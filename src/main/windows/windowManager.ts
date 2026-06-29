import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { IPC } from '@shared/ipc-contract'

const PRELOAD = join(__dirname, '../preload/index.mjs')
const isDev = !!process.env['ELECTRON_RENDERER_URL']
/** Time the renderer's "poof" exit animation needs before we hide the window. */
const VANISH_MS = 420

type WindowKey = 'duck' | 'panel' | 'settings' | 'game'

/**
 * Owns the lifecycle of every app window. Each renderer "page" is a separate HTML
 * entry built by electron-vite; here we map a logical window to its entry + chrome.
 */
export class WindowManager {
  private readonly windows = new Map<WindowKey, BrowserWindow>()
  private duckHideTimer: ReturnType<typeof setTimeout> | null = null

  getDuckWindow(): BrowserWindow | undefined {
    return this.windows.get('duck')
  }

  createDuckWindow(): BrowserWindow {
    const { workArea } = screen.getPrimaryDisplay()
    // Wider/taller than the duck so a larger sprite + speech bubble both fit.
    const width = 300
    const height = 300
    // Spawn at a random location within the primary display's work area.
    const x = workArea.x + Math.floor(Math.random() * Math.max(1, workArea.width - width))
    const y = workArea.y + Math.floor(Math.random() * Math.max(1, workArea.height - height))
    const win = new BrowserWindow({
      width,
      height,
      x,
      y,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: { preload: PRELOAD, sandbox: false }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    win.once('ready-to-show', () => {
      win.showInactive()
      // Enable click-through only after the window is on screen, otherwise some
      // macOS configurations never paint the first frame.
      win.setIgnoreMouseEvents(true, { forward: true })
      console.log(`[VibeDuck] duck window shown at (${x}, ${y})`)
    })

    this.load(win, 'duck')
    this.track('duck', win)
    console.log(`[VibeDuck] duck window created at (${x}, ${y})`)
    return win
  }

  isDuckVisible(): boolean {
    const duck = this.windows.get('duck')
    return !!duck && !duck.isDestroyed() && duck.isVisible()
  }

  togglePanel(): void {
    const existing = this.windows.get('panel')
    if (existing && !existing.isDestroyed()) {
      if (existing.isVisible()) existing.hide()
      else {
        existing.show()
        existing.focus()
      }
      return
    }
    this.windows.delete('panel')
    const { workArea } = screen.getPrimaryDisplay()
    const width = 420
    const height = 560
    const win = new BrowserWindow({
      width,
      height,
      x: workArea.x + workArea.width - width - 24,
      y: workArea.y + 60,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: { preload: PRELOAD, sandbox: false }
    })
    this.load(win, 'panel')
    this.track('panel', win)
  }

  openSettings(): void {
    const existing = this.windows.get('settings')
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore()
      existing.show()
      existing.focus()
      return
    }
    // Drop any stale/destroyed reference so a new window can be created.
    this.windows.delete('settings')
    const win = new BrowserWindow({
      width: 880,
      height: 640,
      title: 'VibeDuck Settings',
      center: true,
      show: true,
      webPreferences: { preload: PRELOAD, sandbox: false }
    })
    this.load(win, 'settings')
    this.track('settings', win)
  }

  setClickThrough(enabled: boolean): void {
    const duck = this.windows.get('duck')
    duck?.setIgnoreMouseEvents(enabled, { forward: true })
  }

  /** Hide/show the duck instantly (no poof) — used while a game is on screen. */
  setDuckHidden(hidden: boolean): void {
    const duck = this.windows.get('duck')
    if (!duck || duck.isDestroyed()) return
    if (hidden) {
      if (this.duckHideTimer) {
        clearTimeout(this.duckHideTimer)
        this.duckHideTimer = null
      }
      if (duck.isVisible()) duck.hide()
    } else if (!duck.isVisible()) {
      duck.showInactive()
    }
  }

  /**
   * A full-screen, interactive overlay that hosts a mini-game on the display the
   * cursor is on. Unlike the duck window it captures mouse events (so the user
   * can play) and is recreated fresh each time.
   */
  openGameWindow(game: string, onClosed: () => void): void {
    const existing = this.windows.get('game')
    if (existing && !existing.isDestroyed()) existing.destroy()
    this.windows.delete('game')

    const cursor = screen.getCursorScreenPoint()
    const { bounds } = screen.getDisplayNearestPoint(cursor)
    const win = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      fullscreenable: false,
      webPreferences: { preload: PRELOAD, sandbox: false }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.once('ready-to-show', () => {
      // Re-assert full-display bounds: on Windows a transparent, frameless window
      // is sometimes created smaller than requested, leaving the game (ground,
      // Stop button) confined to part of the screen. Setting bounds again here
      // guarantees it spans the whole monitor.
      win.setBounds(bounds)
      // Show WITHOUT activating VibeDuck, so the user's coding app stays the active
      // app and keeps rendering/generating behind the transparent overlay (it would
      // otherwise be throttled by the OS once deactivated). Clicks still land on the
      // overlay since it's top-most; keyboard (Space/Esc) starts working after the
      // first click brings the game into focus.
      win.showInactive()
    })
    win.on('closed', onClosed)
    this.load(win, 'game', `game=${encodeURIComponent(game)}`)
    this.track('game', win)
  }

  closeGameWindow(): void {
    const win = this.windows.get('game')
    if (win && !win.isDestroyed()) win.destroy()
    this.windows.delete('game')
  }

  setDuckVisible(visible: boolean): void {
    const duck = this.windows.get('duck')
    if (!duck || duck.isDestroyed()) return
    if (visible) {
      if (this.duckHideTimer) {
        clearTimeout(this.duckHideTimer)
        this.duckHideTimer = null
      }
      // showInactive avoids stealing focus from the user's coding app.
      if (!duck.isVisible()) duck.showInactive()
      // Let the renderer play the entrance "pop" animation.
      duck.webContents.send(IPC.EvtDuckVisibility, { visible: true })
    } else if (duck.isVisible() && !this.duckHideTimer) {
      // Play the "poof" exit animation first, then actually hide the window.
      duck.webContents.send(IPC.EvtDuckVisibility, { visible: false })
      this.duckHideTimer = setTimeout(() => {
        this.duckHideTimer = null
        const d = this.windows.get('duck')
        if (d && !d.isDestroyed() && d.isVisible()) d.hide()
      }, VANISH_MS)
    }
  }

  moveDuck(x: number, y: number): void {
    this.windows.get('duck')?.setPosition(Math.round(x), Math.round(y))
  }

  broadcast<T>(channel: string, payload: T): void {
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
  }

  private load(win: BrowserWindow, key: WindowKey, query?: string): void {
    win.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    // Surface renderer problems in the terminal (invaluable for transparent windows).
    win.webContents.on('console-message', (_e, _level, message) => {
      console.log(`[${key}-renderer] ${message}`)
    })
    win.webContents.on('render-process-gone', (_e, details) => {
      console.error(`[${key}-renderer] process gone: ${details.reason}`)
      // Tear down the dead window so it doesn't linger in the map and block
      // re-opening (e.g. clicking "Settings" again does nothing).
      if (!win.isDestroyed()) win.destroy()
      this.windows.delete(key)
      if (key === 'duck') this.createDuckWindow()
    })
    win.webContents.on('preload-error', (_e, path, error) => {
      console.error(`[${key}-preload] error in ${path}:`, error)
    })
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[VibeDuck] ${key} failed to load: ${code} ${desc} ${url}`)
    })

    if (isDev) {
      const suffix = query ? `?${query}` : ''
      void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${key}.html${suffix}`)
      if (process.env['VIBEDUCK_DEVTOOLS']) {
        win.webContents.openDevTools({ mode: 'detach' })
      }
    } else {
      void win.loadFile(join(__dirname, `../renderer/${key}.html`), query ? { search: query } : undefined)
    }
  }

  private track(key: WindowKey, win: BrowserWindow): void {
    this.windows.set(key, win)
    win.on('closed', () => this.windows.delete(key))
  }
}
