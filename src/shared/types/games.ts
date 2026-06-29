/** Mini-games the duck can play with the user between code generations. */
export type GameId = 'breadCatch' | 'runner'

export interface GameMeta {
  id: GameId
  name: string
  emoji: string
  blurb: string
}

export const GAMES: GameMeta[] = [
  {
    id: 'breadCatch',
    name: 'Bread Catch',
    emoji: '🍞',
    blurb: 'Tap the top of the screen to drop bread — help the duck catch it!'
  },
  {
    id: 'runner',
    name: 'Duck Runner',
    emoji: '🏃',
    blurb: 'Endless runner — tap to jump over obstacles.'
  }
]

/** Swappable artwork slots the user can customize per game. */
export type GameAssetKey = 'breadCatch.bread' | 'runner.obstacle' | 'runner.ground'

export interface GameAsset {
  fileName: string
  /** URL served by the `sprite://` protocol. */
  fileUrl: string
  size: number
  imageWidth: number
  imageHeight: number
  /** Horizontal animation frames in the image (1 = a single static picture). */
  frames: number
  /** Animation speed used when `frames > 1`. */
  fps: number
}

export type GameAssets = Partial<Record<GameAssetKey, GameAsset>>

export interface GameAssetMeta {
  key: GameAssetKey
  label: string
  hint: string
  /** Emoji/glyph shown as the default when no custom art is set. */
  fallback: string
  /** Whether a multi-frame animation makes sense for this slot. */
  animated: boolean
}

export const GAME_ASSETS: GameAssetMeta[] = [
  {
    key: 'breadCatch.bread',
    label: 'Bread',
    hint: 'The falling item the duck catches in Bread Catch.',
    fallback: '🍞',
    animated: true
  },
  {
    key: 'runner.obstacle',
    label: 'Obstacle',
    hint: 'The hurdle the duck jumps over in Duck Runner.',
    fallback: '🌵',
    animated: true
  },
  {
    key: 'runner.ground',
    label: 'Platform / ground',
    hint: 'Tiled left-to-right along the floor in Duck Runner.',
    fallback: '▦',
    animated: false
  }
]
