import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import type { PromptBoostService } from '../services/promptBoostService'
import type { VisibilityService } from '../services/visibilityService'
import type { WindowManager } from './windowManager'

interface TrayDeps {
  windows: WindowManager
  promptBoost: PromptBoostService
  visibility: VisibilityService
}

/** Directory where bundled runtime assets (tray icons) live, dev and packaged. */
function resourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

/**
 * A persistent menu-bar / system-tray presence so the app is always reachable —
 * even while the duck is hidden (it only shows on coding/AI apps). This is the
 * professional "it's running" affordance and the home for global actions.
 */
export function createTray(deps: TrayDeps): Tray {
  const image = nativeImage.createFromPath(join(resourcesDir(), 'tray.png'))
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('VibeDuck')

  const rebuild = (): void => {
    const boostOn = deps.promptBoost.isEnabled()
    const restricted = deps.visibility.getConfig().enabled
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '🦆 Open Assistant', click: () => deps.windows.togglePanel() },
        { label: 'Show Duck', click: () => deps.windows.setDuckVisible(true) },
        { type: 'separator' },
        {
          label: 'Prompt Boost',
          type: 'checkbox',
          checked: boostOn,
          click: () => {
            deps.promptBoost.setEnabled(!boostOn)
            rebuild()
          }
        },
        {
          label: 'Only show in coding apps',
          type: 'checkbox',
          checked: restricted,
          click: () => {
            const cfg = deps.visibility.getConfig()
            deps.visibility.setConfig({ ...cfg, enabled: !restricted })
            rebuild()
          }
        },
        { type: 'separator' },
        { label: 'Settings…', click: () => deps.windows.openSettings() },
        { label: 'About VibeDuck', click: () => deps.windows.openSettings() },
        { type: 'separator' },
        { label: 'Quit VibeDuck', click: () => app.quit() }
      ])
    )
  }

  rebuild()
  // Clicking the icon opens the assistant (most-used action).
  tray.on('click', () => deps.windows.togglePanel())
  return tray
}
