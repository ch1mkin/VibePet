/**
 * Single source of truth for IPC channel names and their typed signatures.
 *
 * - `invoke` channels are request/response (renderer -> main, returns a Promise).
 * - `on` channels are pushes (main -> renderer, fire-and-forget events).
 *
 * The preload bridge and main-process handlers both derive their types from here,
 * so adding a channel here is enforced on both sides at compile time.
 */
import type {
  AICompletionRequest,
  AIStreamChunk,
  AuthResult,
  AuthState,
  ClipboardCategory,
  ClipboardItem,
  DailySummary,
  DuckAnimationState,
  DuckProfile,
  GameAsset,
  GameAssetKey,
  GameAssets,
  GameId,
  PromptCoachResult,
  SpriteGeometry,
  SpriteRange,
  SpriteSetup,
  Task,
  VisibilityConfig
} from './types'

export const IPC = {
  // App / window
  AppGetVersion: 'app:getVersion',
  WindowSetClickThrough: 'window:setClickThrough',
  WindowMoveDuck: 'window:moveDuck',
  PanelToggle: 'panel:toggle',
  SettingsOpen: 'settings:open',

  // Clipboard
  ClipboardList: 'clipboard:list',
  ClipboardSave: 'clipboard:save',
  ClipboardDelete: 'clipboard:delete',
  ClipboardCopy: 'clipboard:copy',

  // Tasks
  TasksUnfinished: 'tasks:unfinished',
  TaskStart: 'task:start',
  TaskUpdate: 'task:update',

  // Duck
  DuckGetProfile: 'duck:getProfile',
  DuckSaveProfile: 'duck:saveProfile',
  DuckContextMenu: 'duck:contextMenu',

  // Prompt Boost (rewrite the prompt before it's sent)
  PromptBoostGet: 'promptBoost:get',
  PromptBoostSet: 'promptBoost:set',

  // Mini-games
  GameStart: 'game:start',
  GameStop: 'game:stop',
  // Custom game artwork (bread / obstacle / platform)
  GameAssetsGet: 'gameAssets:get',
  GameAssetUpload: 'gameAssets:upload',
  GameAssetSet: 'gameAssets:set',
  GameAssetClear: 'gameAssets:clear',

  // AI
  AIComplete: 'ai:complete',
  AIPromptCoach: 'ai:promptCoach',
  AISaveApiKey: 'ai:saveApiKey',
  AIHasApiKey: 'ai:hasApiKey',

  // Settings
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',

  // Sprites — method 1: per-action sheets
  SpriteGetConfig: 'sprite:getConfig',
  SpriteUploadFor: 'sprite:uploadFor',
  SpriteSetGeometry: 'sprite:setGeometry',
  SpriteClear: 'sprite:clear',
  // Sprites — method 2: one master atlas sliced into frame ranges
  SpriteUploadAtlas: 'sprite:uploadAtlas',
  SpriteSetAtlasGeometry: 'sprite:setAtlasGeometry',
  SpriteClearAtlas: 'sprite:clearAtlas',
  SpriteSetRange: 'sprite:setRange',
  // A single static image that replaces the emoji glyph (still CSS-animated)
  SpriteUploadBase: 'sprite:uploadBase',
  SpriteClearBase: 'sprite:clearBase',

  // Visibility (show duck only on coding/AI apps)
  VisibilityGet: 'visibility:get',
  VisibilitySet: 'visibility:set',

  // Auth (Supabase cloud account)
  AuthGetState: 'auth:getState',
  AuthSignUp: 'auth:signUp',
  AuthSignIn: 'auth:signIn',
  AuthSignOut: 'auth:signOut',

  // Summaries
  SummaryToday: 'summary:today',

  // Push events (main -> renderer)
  EvtAIStream: 'evt:aiStream',
  EvtDuckBehavior: 'evt:duckBehavior',
  EvtClipboardCaptured: 'evt:clipboardCaptured',
  EvtDuckMotion: 'evt:duckMotion',
  EvtDuckSay: 'evt:duckSay',
  EvtDuckDraft: 'evt:duckDraft',
  EvtDuckVisibility: 'evt:duckVisibility',
  EvtSpriteConfig: 'evt:spriteConfig',
  EvtAuthState: 'evt:authState',
  EvtPromptBoost: 'evt:promptBoost',
  EvtGameAssets: 'evt:gameAssets'
} as const

/** Request/response channel signatures. */
export interface IpcInvokeMap {
  [IPC.AppGetVersion]: { args: []; result: string }
  [IPC.WindowSetClickThrough]: { args: [enabled: boolean]; result: void }
  [IPC.WindowMoveDuck]: { args: [x: number, y: number]; result: void }
  [IPC.PanelToggle]: { args: []; result: void }
  [IPC.SettingsOpen]: { args: []; result: void }

  [IPC.ClipboardList]: { args: [query?: string]; result: ClipboardItem[] }
  [IPC.ClipboardSave]: { args: [item: Partial<ClipboardItem>]; result: ClipboardItem }
  [IPC.ClipboardDelete]: { args: [id: string]; result: void }
  [IPC.ClipboardCopy]: { args: [content: string, category: ClipboardCategory]; result: void }

  [IPC.TasksUnfinished]: { args: []; result: Task[] }
  [IPC.TaskStart]: { args: [name: string]; result: Task }
  [IPC.TaskUpdate]: { args: [task: Partial<Task> & { id: string }]; result: Task }

  [IPC.DuckGetProfile]: { args: []; result: DuckProfile }
  [IPC.DuckSaveProfile]: { args: [profile: Partial<DuckProfile>]; result: DuckProfile }
  [IPC.DuckContextMenu]: { args: []; result: void }

  [IPC.PromptBoostGet]: { args: []; result: { enabled: boolean } }
  [IPC.PromptBoostSet]: { args: [enabled: boolean]; result: { enabled: boolean } }

  [IPC.GameStart]: { args: [game: GameId]; result: void }
  [IPC.GameStop]: { args: []; result: void }
  [IPC.GameAssetsGet]: { args: []; result: GameAssets }
  [IPC.GameAssetUpload]: { args: [key: GameAssetKey]; result: GameAssets }
  [IPC.GameAssetSet]: { args: [key: GameAssetKey, opts: Pick<GameAsset, 'frames' | 'fps'>]; result: GameAssets }
  [IPC.GameAssetClear]: { args: [key: GameAssetKey]; result: GameAssets }

  [IPC.AIComplete]: { args: [request: AICompletionRequest]; result: string }
  [IPC.AIPromptCoach]: { args: [prompt: string]; result: PromptCoachResult }
  [IPC.AISaveApiKey]: { args: [key: string]; result: void }
  [IPC.AIHasApiKey]: { args: []; result: boolean }

  [IPC.SettingsGet]: { args: [key: string]; result: string | null }
  [IPC.SettingsSet]: { args: [key: string, value: string]; result: void }

  [IPC.SpriteGetConfig]: { args: []; result: SpriteSetup }
  [IPC.SpriteUploadFor]: { args: [state: DuckAnimationState]; result: SpriteSetup }
  [IPC.SpriteSetGeometry]: { args: [state: DuckAnimationState, geometry: SpriteGeometry]; result: SpriteSetup }
  [IPC.SpriteClear]: { args: [state: DuckAnimationState]; result: SpriteSetup }
  [IPC.SpriteUploadAtlas]: { args: []; result: SpriteSetup }
  [IPC.SpriteSetAtlasGeometry]: { args: [geometry: SpriteGeometry]; result: SpriteSetup }
  [IPC.SpriteClearAtlas]: { args: []; result: SpriteSetup }
  [IPC.SpriteSetRange]: { args: [state: DuckAnimationState, range: SpriteRange | null]; result: SpriteSetup }
  [IPC.SpriteUploadBase]: { args: []; result: SpriteSetup }
  [IPC.SpriteClearBase]: { args: []; result: SpriteSetup }

  [IPC.VisibilityGet]: { args: []; result: VisibilityConfig }
  [IPC.VisibilitySet]: { args: [config: VisibilityConfig]; result: void }

  [IPC.AuthGetState]: { args: []; result: AuthState }
  [IPC.AuthSignUp]: { args: [email: string, password: string]; result: AuthResult }
  [IPC.AuthSignIn]: { args: [email: string, password: string]; result: AuthResult }
  [IPC.AuthSignOut]: { args: []; result: void }

  [IPC.SummaryToday]: { args: []; result: DailySummary }
}

/** Push event channel payloads (main -> renderer). */
export interface IpcEventMap {
  [IPC.EvtAIStream]: AIStreamChunk
  [IPC.EvtDuckBehavior]: { behavior: string }
  [IPC.EvtClipboardCaptured]: ClipboardItem
  [IPC.EvtDuckMotion]: { moving: boolean; fast: boolean; facing: 'left' | 'right' }
  [IPC.EvtDuckSay]: { text: string; durationMs?: number; tone?: 'info' | 'happy' | 'tip' }
  [IPC.EvtDuckDraft]: { text: string }
  [IPC.EvtDuckVisibility]: { visible: boolean }
  [IPC.EvtSpriteConfig]: SpriteSetup
  [IPC.EvtAuthState]: AuthState
  [IPC.EvtPromptBoost]: { enabled: boolean }
  [IPC.EvtGameAssets]: GameAssets
}

export type IpcInvokeChannel = keyof IpcInvokeMap
export type IpcEventChannel = keyof IpcEventMap
