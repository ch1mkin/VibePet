/**
 * Duck animation states. The renderer state machine maps each to a sprite clip.
 */
export type DuckAnimationState =
  | 'idle'
  | 'walking'
  | 'running'
  | 'sleeping'
  | 'thinking'
  | 'coding'
  | 'greeting'
  | 'happy'
  | 'excited'
  | 'confused'
  | 'celebrating'
  | 'eating'
  | 'drinkingCoffee'
  | 'readingDocs'
  | 'flying'
  | 'lookingAround'
  | 'sitting'

export type DuckSize = 32 | 48 | 64

export interface DuckProfile {
  id: string
  name: string
  skin: string
  xp: number
  level: number
  accessories: string[]
}

export interface DuckRuntimeState {
  animation: DuckAnimationState
  facing: 'left' | 'right'
  x: number
  y: number
}
