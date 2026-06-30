import { app, clipboard, ipcMain, Menu } from 'electron'
import { IPC, type IpcInvokeChannel, type IpcInvokeMap } from '@shared/ipc-contract'
import type { Repositories } from '../database'
import type { AIService } from '../services/aiService'
import type { ClipboardService } from '../services/clipboardService'
import type { DuckMotionService } from '../services/duckMotionService'
import type { GameAssetService } from '../services/gameAssetService'
import type { GameService } from '../services/gameService'
import type { PromptBoostService } from '../services/promptBoostService'
import type { SpriteService } from '../services/spriteService'
import type { SupabaseService } from '../services/supabaseService'
import type { VisibilityService } from '../services/visibilityService'
import type { WindowManager } from '../windows/windowManager'

interface IpcDeps {
  repos: Repositories
  ai: AIService
  windows: WindowManager
  sprites: SpriteService
  visibility: VisibilityService
  auth: SupabaseService
  clipboard: ClipboardService
  motion: DuckMotionService
  promptBoost: PromptBoostService
  games: GameService
  gameAssets: GameAssetService
}

/**
 * Type-safe wrapper around ipcMain.handle that enforces the contract signatures.
 */
function handle<C extends IpcInvokeChannel>(
  channel: C,
  handler: (...args: IpcInvokeMap[C]['args']) => Promise<IpcInvokeMap[C]['result']> | IpcInvokeMap[C]['result']
): void {
  ipcMain.handle(channel, (_event, ...args) =>
    handler(...(args as IpcInvokeMap[C]['args']))
  )
}

/** Registers every request/response IPC handler. Push events are sent via WindowManager. */
export function registerIpc({
  repos,
  ai,
  windows,
  sprites,
  visibility,
  auth,
  clipboard: clipboardSvc,
  motion,
  promptBoost,
  games,
  gameAssets
}: IpcDeps): void {
  handle(IPC.AppGetVersion, () => app.getVersion())
  handle(IPC.WindowSetClickThrough, (enabled) => windows.setClickThrough(enabled))
  handle(IPC.WindowMoveDuck, (x, y) => windows.moveDuck(x, y))
  handle(IPC.PanelToggle, () => windows.togglePanel())
  handle(IPC.SettingsOpen, () => windows.openSettings())

  handle(IPC.ClipboardList, (query) => repos.clipboard.list(query))
  handle(IPC.ClipboardSave, (item) => repos.clipboard.save(item))
  handle(IPC.ClipboardDelete, (id) => repos.clipboard.delete(id))
  handle(IPC.ClipboardCopy, (content, category) => clipboardSvc.copy(content, category))

  handle(IPC.TasksUnfinished, () => repos.tasks.unfinished())
  handle(IPC.TaskStart, (name) => repos.tasks.start(name))
  handle(IPC.TaskUpdate, (task) => repos.tasks.update(task))

  handle(IPC.DuckGetProfile, () => repos.duck.getProfile())
  handle(IPC.DuckSaveProfile, (profile) => repos.duck.saveProfile(profile))
  handle(IPC.DuckSpeaking, (speaking) => motion.setSpeaking(speaking))

  handle(IPC.PromptBoostGet, () => promptBoost.getState())
  handle(IPC.PromptBoostSet, (enabled) => promptBoost.setEnabled(enabled))

  handle(IPC.GameStart, (game) => games.start(game))
  handle(IPC.GameStop, () => games.stop())

  const announceAssets = (assets: ReturnType<GameAssetService['getAssets']>): typeof assets => {
    windows.broadcast(IPC.EvtGameAssets, assets)
    return assets
  }
  handle(IPC.GameAssetsGet, () => gameAssets.getAssets())
  handle(IPC.GameAssetUpload, async (key) => announceAssets(await gameAssets.upload(key)))
  handle(IPC.GameAssetSet, (key, opts) => announceAssets(gameAssets.set(key, opts)))
  handle(IPC.GameAssetClear, (key) => announceAssets(gameAssets.clear(key)))

  const improveClipboard = async (): Promise<void> => {
    const text = clipboard.readText().trim()
    if (!text) {
      windows.broadcast(IPC.EvtDuckSay, { text: 'clipboard is empty 🤷', tone: 'tip' })
      return
    }
    windows.broadcast(IPC.EvtDuckBehavior, { behavior: 'thinking' })
    windows.broadcast(IPC.EvtDuckSay, { text: 'improving your clipboard… ✨', tone: 'info' })
    try {
      clipboard.writeText(await ai.improvePrompt(text))
      windows.broadcast(IPC.EvtDuckBehavior, { behavior: 'celebrating' })
      windows.broadcast(IPC.EvtDuckSay, { text: 'done — paste it anywhere! 📋', tone: 'happy' })
    } catch (err) {
      const missingKey = err instanceof Error && /api key/i.test(err.message)
      windows.broadcast(IPC.EvtDuckSay, {
        text: missingKey ? 'add an OpenRouter API key in Settings' : "couldn't reach the AI",
        tone: 'tip'
      })
    }
  }

  handle(IPC.DuckContextMenu, () => {
    const boostOn = promptBoost.isEnabled()
    const sitting = motion.isSitting()
    const menu = Menu.buildFromTemplate([
      { label: '🦆 Open Assistant', click: () => windows.togglePanel() },
      { type: 'separator' },
      {
        label: 'Boost current prompt  (⌘↵)',
        enabled: boostOn,
        click: () => void promptBoost.trigger()
      },
      { label: 'Improve clipboard text', click: () => void improveClipboard() },
      { type: 'separator' },
      {
        label: 'Prompt Boost',
        type: 'checkbox',
        checked: boostOn,
        click: () => promptBoost.setEnabled(!boostOn)
      },
      {
        label: 'Sit still',
        type: 'checkbox',
        checked: sitting,
        click: () => {
          const nowSitting = motion.toggleSit()
          windows.broadcast(IPC.EvtDuckBehavior, { behavior: nowSitting ? 'sitting' : 'happy' })
        }
      },
      { type: 'separator' },
      { label: 'Settings…', click: () => windows.openSettings() },
      { type: 'separator' },
      { label: 'Quit VibeDuck', click: () => app.quit() }
    ])
    menu.popup({ window: windows.getDuckWindow() })
  })

  handle(IPC.AIComplete, (request) => ai.complete(request))
  handle(IPC.AIPromptCoach, (prompt) => ai.promptCoach(prompt))
  handle(IPC.AISaveApiKey, (key) => ai.saveApiKey(key))
  handle(IPC.AIHasApiKey, () => ai.hasApiKey())

  handle(IPC.SettingsGet, (key) => repos.settings.get(key))
  handle(IPC.SettingsSet, (key, value) => repos.settings.set(key, value))

  const announceSprites = (setup: ReturnType<SpriteService['getSetup']>): typeof setup => {
    windows.broadcast(IPC.EvtSpriteConfig, setup)
    return setup
  }
  handle(IPC.SpriteGetConfig, () => sprites.getSetup())
  handle(IPC.SpriteUploadFor, async (state) => announceSprites(await sprites.uploadClip(state)))
  handle(IPC.SpriteSetGeometry, (state, geometry) => announceSprites(sprites.setClipGeometry(state, geometry)))
  handle(IPC.SpriteClear, (state) => announceSprites(sprites.clearClip(state)))
  handle(IPC.SpriteUploadAtlas, async () => announceSprites(await sprites.uploadAtlas()))
  handle(IPC.SpriteSetAtlasGeometry, (geometry) => announceSprites(sprites.setAtlasGeometry(geometry)))
  handle(IPC.SpriteClearAtlas, () => announceSprites(sprites.clearAtlas()))
  handle(IPC.SpriteSetRange, (state, range) => announceSprites(sprites.setRange(state, range)))
  handle(IPC.SpriteUploadBase, async () => announceSprites(await sprites.uploadBaseImage()))
  handle(IPC.SpriteClearBase, () => announceSprites(sprites.clearBaseImage()))

  handle(IPC.VisibilityGet, () => visibility.getConfig())
  handle(IPC.VisibilitySet, (config) => visibility.setConfig(config))

  handle(IPC.AuthGetState, () => auth.getState())
  handle(IPC.AuthSignUp, (email, password) => auth.signUp(email, password))
  handle(IPC.AuthSignIn, (email, password) => auth.signIn(email, password))
  handle(IPC.AuthSignOut, () => auth.signOut())

  handle(IPC.SummaryToday, () => repos.summary.today())
}
