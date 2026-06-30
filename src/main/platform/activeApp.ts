import { exec, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promisify } from 'node:util'
import { clipboard } from 'electron'

const run = promisify(exec)
const EXEC_TIMEOUT = 1500

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export interface ActiveAppInfo {
  /** Display/app name, e.g. "Cursor", "Google Chrome". */
  appName: string
  /** Foreground window title when obtainable (Windows). */
  title?: string
  /** Active browser tab URL when obtainable (macOS, best-effort). */
  url?: string
  /** Foreground window rect in PHYSICAL pixels (Windows, best-effort). */
  bounds?: { x: number; y: number; w: number; h: number }
}

/** The currently focused text field's on-screen rect and value (best-effort). */
export interface FocusedField {
  x: number
  y: number
  w: number
  h: number
  text: string
}

export interface ActiveAppAdapter {
  /** Returns the foreground application, or null if detection failed. */
  getActive(): Promise<ActiveAppInfo | null>
  /**
   * Best-effort read of the focused text field (macOS Accessibility). Returns
   * null when unsupported or permission isn't granted.
   */
  getFocusedField(): Promise<FocusedField | null>
  /**
   * Replace the focused field's entire contents with `text` (select-all + paste).
   * Returns false when the OS automation isn't available/permitted.
   */
  replaceFocusedText(text: string): Promise<boolean>
  /**
   * Grab the focused field's full text via select-all + copy. This works in apps
   * that don't expose AXValue (ChatGPT in a browser, Cursor, other Electron/web
   * editors) where `getFocusedField().text` comes back empty. Returns '' when
   * nothing could be copied, or null when automation isn't available/permitted.
   * On success the copied text is left on the clipboard.
   */
  captureFocusedText(): Promise<string | null>
  /**
   * Replace the focused field with `text` (select-all + paste) and LEAVE `text`
   * on the clipboard afterwards (so the user can paste it elsewhere too).
   */
  pasteText(text: string): Promise<boolean>
  /** Simulate pressing Enter/Return in the focused app to submit. */
  submitFocused(): Promise<boolean>
  /** Release any OS resources (e.g. a persistent helper process). */
  dispose?(): void
}

const MAC_BROWSERS = new Set([
  'Safari',
  'Google Chrome',
  'Google Chrome Canary',
  'Brave Browser',
  'Microsoft Edge',
  'Arc',
  'Chromium',
  'Vivaldi',
  'Opera',
  'Dia',
  'Zen'
])

/** macOS: app via `lsappinfo` (no accessibility prompt), URL via AppleScript (best-effort). */
class DarwinActiveApp implements ActiveAppAdapter {
  async getActive(): Promise<ActiveAppInfo | null> {
    const appName = await this.frontAppName()
    if (!appName) return null
    const info: ActiveAppInfo = { appName }
    if (MAC_BROWSERS.has(appName)) {
      const url = await this.browserUrl(appName)
      if (url) info.url = url
    }
    return info
  }

  private async frontAppName(): Promise<string | null> {
    try {
      const { stdout: asn } = await run('lsappinfo front', { timeout: EXEC_TIMEOUT })
      const front = asn.trim()
      if (!front) return null
      const { stdout } = await run(`lsappinfo info -only name ${front}`, { timeout: EXEC_TIMEOUT })
      const match = stdout.match(/="([^"]+)"\s*$/m)
      return match ? match[1] : null
    } catch {
      return null
    }
  }

  private async browserUrl(appName: string): Promise<string | null> {
    const script =
      appName === 'Safari'
        ? 'tell application "Safari" to return URL of front document'
        : `tell application "${appName}" to return URL of active tab of front window`
    try {
      const { stdout } = await run(`osascript -e '${script}'`, { timeout: EXEC_TIMEOUT })
      return stdout.trim() || null
    } catch {
      // Automation permission not granted, or no window — fall back to app name only.
      return null
    }
  }

  async getFocusedField(): Promise<FocusedField | null> {
    // Reads the focused element's rect + value via Accessibility (needs permission).
    const script = `tell application "System Events"
set p to first process whose frontmost is true
set f to value of attribute "AXFocusedUIElement" of p
set t to ""
try
set t to (value of attribute "AXValue" of f) as string
end try
set ps to value of attribute "AXPosition" of f
set sz to value of attribute "AXSize" of f
return ((item 1 of ps) as integer as string) & "|" & ((item 2 of ps) as integer as string) & "|" & ((item 1 of sz) as integer as string) & "|" & ((item 2 of sz) as integer as string) & "|" & t
end tell`
    try {
      const { stdout } = await run(`osascript -e '${script}'`, { timeout: EXEC_TIMEOUT })
      const parts = stdout.trim().split('|')
      if (parts.length < 5) return null
      const [x, y, w, h] = parts.map(Number)
      if ([x, y, w, h].some((n) => !Number.isFinite(n))) return null
      return { x, y, w, h, text: parts.slice(4).join('|') }
    } catch {
      return null
    }
  }

  async replaceFocusedText(text: string): Promise<boolean> {
    // Most reliable cross-app approach: stage the new text on the clipboard,
    // select-all in the focused field, paste, then restore the old clipboard.
    const previous = clipboard.readText()
    clipboard.writeText(text)
    try {
      await run(
        `osascript -e 'tell application "System Events"' ` +
          `-e 'keystroke "a" using command down' -e 'delay 0.05' ` +
          `-e 'keystroke "v" using command down' -e 'end tell'`,
        { timeout: EXEC_TIMEOUT }
      )
      return true
    } catch {
      return false
    } finally {
      // Give the paste a beat before putting the user's clipboard back.
      setTimeout(() => clipboard.writeText(previous), 400)
    }
  }

  async captureFocusedText(): Promise<string | null> {
    const previous = clipboard.readText()
    const sentinel = `__vibeduck_${Date.now()}__`
    clipboard.writeText(sentinel)
    try {
      await run(
        `osascript -e 'tell application "System Events"' ` +
          `-e 'keystroke "a" using command down' -e 'delay 0.1' ` +
          `-e 'keystroke "c" using command down' -e 'end tell'`,
        { timeout: EXEC_TIMEOUT }
      )
      await wait(220)
      const text = clipboard.readText()
      if (text === sentinel || text === '') {
        clipboard.writeText(previous)
        return ''
      }
      return text
    } catch {
      clipboard.writeText(previous)
      return null
    }
  }

  async pasteText(text: string): Promise<boolean> {
    clipboard.writeText(text)
    try {
      await run(
        `osascript -e 'tell application "System Events"' ` +
          `-e 'keystroke "a" using command down' -e 'delay 0.05' ` +
          `-e 'keystroke "v" using command down' -e 'end tell'`,
        { timeout: EXEC_TIMEOUT }
      )
      return true
    } catch {
      return false
    }
    // Intentionally no clipboard restore: leave `text` so the user can re-paste.
  }

  async submitFocused(): Promise<boolean> {
    try {
      // key code 36 == Return.
      await run(`osascript -e 'tell application "System Events" to key code 36'`, {
        timeout: EXEC_TIMEOUT
      })
      return true
    } catch {
      return false
    }
  }
}

/**
 * A single long-lived PowerShell process for fast foreground-window queries.
 *
 * The previous design spawned a new `powershell` AND recompiled a C# type on
 * EVERY poll (~1/sec). On Windows that was both slow (visible lag) and flaky
 * (timeouts made the duck "fail open" and show on every app). Here we spawn one
 * interactive PowerShell, compile the Win32 type ONCE, and answer each query in
 * milliseconds by writing a one-line command and reading back a marker-delimited
 * result.
 */
class PowerShellHost {
  private proc: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private seq = 0
  private queue: Array<{
    start: string
    end: string
    resolve: (value: string) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
    done: boolean
  }> = []

  private static readonly INIT = [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Text; public class Win { public struct RECT { public int Left, Top, Right, Bottom; } [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h, out RECT r); }'",
    "function Get-Fg { $h = [Win]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder 512; [void][Win]::GetWindowText($h, $sb, 512); $procId = 0; [void][Win]::GetWindowThreadProcessId($h, [ref]$procId); $proc = ''; try { $proc = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}; $r = New-Object Win+RECT; [void][Win]::GetWindowRect($h, [ref]$r); Write-Output ($proc + '|' + $r.Left + '|' + $r.Top + '|' + $r.Right + '|' + $r.Bottom + '|' + $sb.ToString()) }"
  ]

  private ensure(): ChildProcessWithoutNullStreams | null {
    if (this.proc && this.proc.exitCode === null && !this.proc.killed) return this.proc
    try {
      const proc = spawn(
        'powershell',
        ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass'],
        { windowsHide: true }
      )
      this.proc = proc
      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', (d: string) => this.onData(d))
      proc.on('exit', () => this.teardown())
      proc.on('error', () => this.teardown())
      proc.stdin.on('error', () => this.teardown())
      for (const line of PowerShellHost.INIT) proc.stdin.write(line + '\n')
      return proc
    } catch {
      this.proc = null
      return null
    }
  }

  private teardown(): void {
    this.proc = null
    this.buffer = ''
    const pending = this.queue.splice(0)
    for (const job of pending) {
      clearTimeout(job.timer)
      if (!job.done) {
        job.done = true
        job.reject(new Error('powershell host stopped'))
      }
    }
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    // Resolve completed jobs in FIFO order (PowerShell executes our writes
    // sequentially, so results arrive in the same order).
    while (this.queue.length > 0) {
      const job = this.queue[0]
      const si = this.buffer.indexOf(job.start)
      if (si < 0) break
      const ei = this.buffer.indexOf(job.end, si + job.start.length)
      if (ei < 0) break
      const payload = this.buffer.slice(si + job.start.length, ei)
      this.buffer = this.buffer.slice(ei + job.end.length)
      this.queue.shift()
      clearTimeout(job.timer)
      if (!job.done) {
        job.done = true
        job.resolve(payload)
      }
    }
    // Guard against unbounded growth if something desyncs.
    if (this.buffer.length > 65536) this.buffer = this.buffer.slice(-4096)
  }

  exec(command: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = this.ensure()
      if (!proc) {
        reject(new Error('powershell unavailable'))
        return
      }
      const id = ++this.seq
      const start = `<<VBS${id}>>`
      const end = `<<VBE${id}>>`
      const job = { start, end, resolve, reject, done: false, timer: setTimeout(() => {}, 0) }
      job.timer = setTimeout(() => {
        if (!job.done) {
          job.done = true
          reject(new Error('powershell query timed out'))
        }
      }, timeoutMs)
      this.queue.push(job)
      try {
        proc.stdin.write(`Write-Output '${start}'; ${command}; Write-Output '${end}'\n`)
      } catch {
        clearTimeout(job.timer)
        if (!job.done) {
          job.done = true
          reject(new Error('powershell write failed'))
        }
      }
    })
  }

  dispose(): void {
    const proc = this.proc
    this.teardown()
    if (proc) {
      try {
        proc.kill()
      } catch {
        /* ignore */
      }
    }
  }
}

/** Windows: foreground process name + window title via a persistent PowerShell host. */
class Win32ActiveApp implements ActiveAppAdapter {
  private readonly host = new PowerShellHost()

  async getActive(): Promise<ActiveAppInfo | null> {
    try {
      const out = await this.host.exec('Get-Fg', 4000)
      const parts = out.trim().split('|')
      const proc = parts[0]?.trim()
      if (!proc) return null
      const info: ActiveAppInfo = { appName: proc, title: parts.slice(5).join('|').trim() }
      const [left, top, right, bottom] = parts.slice(1, 5).map(Number)
      if ([left, top, right, bottom].every(Number.isFinite) && right > left && bottom > top) {
        info.bounds = { x: left, y: top, w: right - left, h: bottom - top }
      }
      return info
    } catch {
      return null
    }
  }

  dispose(): void {
    this.host.dispose()
  }

  /** Reads the focused control's bounds + text via Windows UI Automation. */
  private static readonly FOCUS_PS = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$el = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($null -eq $el) { return }
$r = $el.Current.BoundingRectangle
$val = ''
try {
  $vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  $val = $vp.Current.Value
} catch {
  try {
    $tp = $el.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
    $val = $tp.DocumentRange.GetText(-1)
  } catch {}
}
$val = $val -replace "\\r?\\n", " "
Write-Output ("{0}|{1}|{2}|{3}|{4}" -f [int]$r.X, [int]$r.Y, [int]$r.Width, [int]$r.Height, $val)`

  async getFocusedField(): Promise<FocusedField | null> {
    try {
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${Win32ActiveApp.FOCUS_PS.replace(/"/g, '\\"')}"`
      const { stdout } = await run(cmd, { timeout: EXEC_TIMEOUT * 2 })
      const parts = stdout.trim().split('|')
      if (parts.length < 5) return null
      const [x, y, w, h] = parts.map(Number)
      if ([x, y, w, h].some((n) => !Number.isFinite(n)) || w <= 0 || h <= 0) return null
      return { x, y, w, h, text: parts.slice(4).join('|') }
    } catch {
      return null
    }
  }

  async replaceFocusedText(text: string): Promise<boolean> {
    const previous = clipboard.readText()
    clipboard.writeText(text)
    try {
      const ps = `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 40; [System.Windows.Forms.SendKeys]::SendWait('^v')`
      await run(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, {
        timeout: EXEC_TIMEOUT * 2
      })
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => clipboard.writeText(previous), 400)
    }
  }

  async captureFocusedText(): Promise<string | null> {
    const previous = clipboard.readText()
    const sentinel = `__vibeduck_${Date.now()}__`
    clipboard.writeText(sentinel)
    try {
      const ps = `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 50; [System.Windows.Forms.SendKeys]::SendWait('^c')`
      await run(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, {
        timeout: EXEC_TIMEOUT * 2
      })
      await wait(160)
      const text = clipboard.readText()
      if (text === sentinel || text === '') {
        clipboard.writeText(previous)
        return ''
      }
      return text
    } catch {
      clipboard.writeText(previous)
      return null
    }
  }

  async pasteText(text: string): Promise<boolean> {
    clipboard.writeText(text)
    try {
      const ps = `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.SendKeys]::SendWait('^a'); Start-Sleep -Milliseconds 40; [System.Windows.Forms.SendKeys]::SendWait('^v')`
      await run(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, {
        timeout: EXEC_TIMEOUT * 2
      })
      return true
    } catch {
      return false
    }
  }

  async submitFocused(): Promise<boolean> {
    try {
      const ps = `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`
      await run(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`, {
        timeout: EXEC_TIMEOUT
      })
      return true
    } catch {
      return false
    }
  }
}

class NoopActiveApp implements ActiveAppAdapter {
  async getActive(): Promise<ActiveAppInfo | null> {
    return null
  }

  async getFocusedField(): Promise<FocusedField | null> {
    return null
  }

  async replaceFocusedText(): Promise<boolean> {
    return false
  }

  async captureFocusedText(): Promise<string | null> {
    return null
  }

  async pasteText(): Promise<boolean> {
    return false
  }

  async submitFocused(): Promise<boolean> {
    return false
  }
}

/**
 * Wraps another adapter to (a) cache `getActive()` for a short TTL and (b)
 * coalesce concurrent calls into one. Two services poll the foreground app
 * (visibility + prompt-watch); without this they'd each pay the OS cost.
 */
class CachedActiveApp implements ActiveAppAdapter {
  private cache: { at: number; value: ActiveAppInfo | null } | null = null
  private inflight: Promise<ActiveAppInfo | null> | null = null

  constructor(
    private readonly inner: ActiveAppAdapter,
    private readonly ttlMs = 600
  ) {}

  async getActive(): Promise<ActiveAppInfo | null> {
    const now = Date.now()
    if (this.cache && now - this.cache.at < this.ttlMs) return this.cache.value
    if (this.inflight) return this.inflight
    this.inflight = this.inner
      .getActive()
      .then((value) => {
        this.cache = { at: Date.now(), value }
        return value
      })
      .finally(() => {
        this.inflight = null
      })
    return this.inflight
  }

  getFocusedField(): Promise<FocusedField | null> {
    return this.inner.getFocusedField()
  }
  replaceFocusedText(text: string): Promise<boolean> {
    return this.inner.replaceFocusedText(text)
  }
  captureFocusedText(): Promise<string | null> {
    return this.inner.captureFocusedText()
  }
  pasteText(text: string): Promise<boolean> {
    return this.inner.pasteText(text)
  }
  submitFocused(): Promise<boolean> {
    return this.inner.submitFocused()
  }
  dispose(): void {
    this.inner.dispose?.()
  }
}

export function createActiveAppAdapter(): ActiveAppAdapter {
  const base =
    process.platform === 'darwin'
      ? new DarwinActiveApp()
      : process.platform === 'win32'
        ? new Win32ActiveApp()
        : new NoopActiveApp()
  return new CachedActiveApp(base)
}
