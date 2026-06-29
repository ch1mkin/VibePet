import type { DuckAnimationState } from '@shared/types'

export interface IdleBehavior {
  state: DuckAnimationState
  /** How long the behavior plays, in ms. */
  durationMs: number
  weight: number
}

/**
 * Pool of random idle behaviors the duck cycles through every few minutes.
 * Weighted so calm states dominate and rarer flourishes feel special.
 */
export const IDLE_BEHAVIORS: IdleBehavior[] = [
  { state: 'idle', durationMs: 6000, weight: 6 },
  { state: 'lookingAround', durationMs: 3000, weight: 3 },
  { state: 'walking', durationMs: 5000, weight: 4 },
  { state: 'sitting', durationMs: 5000, weight: 2 },
  { state: 'drinkingCoffee', durationMs: 4000, weight: 2 },
  { state: 'readingDocs', durationMs: 5000, weight: 1 },
  { state: 'sleeping', durationMs: 8000, weight: 1 },
  { state: 'happy', durationMs: 2500, weight: 1 }
]

export function pickIdleBehavior(): IdleBehavior {
  const total = IDLE_BEHAVIORS.reduce((sum, b) => sum + b.weight, 0)
  let roll = Math.random() * total
  for (const behavior of IDLE_BEHAVIORS) {
    roll -= behavior.weight
    if (roll <= 0) return behavior
  }
  return IDLE_BEHAVIORS[0]
}
