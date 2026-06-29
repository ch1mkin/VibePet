import type { DuckAnimationState } from '@shared/types'

/**
 * Temporary emoji representation of each duck state, used until real sprite-sheet
 * animations are uploaded. `motion` maps to a CSS animation class in global.css.
 */
export interface EmojiBehavior {
  emoji: string
  /** Optional small accessory/prop emoji shown beside the duck. */
  prop?: string
  motion: 'bob' | 'walk' | 'run' | 'spin' | 'shake' | 'float' | 'still' | 'jump' | 'wave' | 'think' | 'fly'
  label: string
}

const BASE = '🦆'

export const EMOJI_MAP: Record<DuckAnimationState, EmojiBehavior> = {
  idle: { emoji: BASE, motion: 'bob', label: 'Idle' },
  walking: { emoji: BASE, motion: 'walk', label: 'Walking' },
  running: { emoji: BASE, motion: 'run', label: 'Running' },
  sleeping: { emoji: BASE, prop: '💤', motion: 'still', label: 'Sleeping' },
  thinking: { emoji: BASE, prop: '💭', motion: 'think', label: 'Thinking' },
  coding: { emoji: BASE, prop: '💻', motion: 'shake', label: 'Coding' },
  greeting: { emoji: BASE, prop: '👋', motion: 'wave', label: 'Hi' },
  happy: { emoji: BASE, prop: '✨', motion: 'jump', label: 'Happy' },
  excited: { emoji: BASE, prop: '⚡', motion: 'jump', label: 'Excited' },
  confused: { emoji: BASE, prop: '❓', motion: 'shake', label: 'Confused' },
  celebrating: { emoji: BASE, prop: '🎉', motion: 'jump', label: 'Celebrating' },
  eating: { emoji: BASE, prop: '🍞', motion: 'bob', label: 'Eating' },
  drinkingCoffee: { emoji: BASE, prop: '☕', motion: 'bob', label: 'Coffee' },
  readingDocs: { emoji: BASE, prop: '📖', motion: 'still', label: 'Reading' },
  flying: { emoji: BASE, prop: '🪽', motion: 'fly', label: 'Flying' },
  lookingAround: { emoji: BASE, prop: '👀', motion: 'shake', label: 'Looking' },
  sitting: { emoji: BASE, motion: 'still', label: 'Sitting' }
}

export function emojiFor(state: DuckAnimationState): EmojiBehavior {
  return EMOJI_MAP[state] ?? EMOJI_MAP.idle
}
