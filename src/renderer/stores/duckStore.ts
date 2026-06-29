import { create } from 'zustand'
import type { DuckAnimationState } from '@shared/types'

interface DuckStore {
  /** Base animation set by idle behaviors / reactions. */
  animation: DuckAnimationState
  moving: boolean
  fast: boolean
  facing: 'left' | 'right'
  setAnimation: (animation: DuckAnimationState) => void
  /** A transient reaction overrides idle behavior, then auto-resets. */
  react: (animation: DuckAnimationState, durationMs?: number) => void
  setMotion: (motion: { moving: boolean; fast: boolean; facing: 'left' | 'right' }) => void
}

let reactionTimer: ReturnType<typeof setTimeout> | null = null

export const useDuckStore = create<DuckStore>((set) => ({
  animation: 'idle',
  moving: false,
  fast: false,
  facing: 'left',
  setAnimation: (animation) => set({ animation }),
  react: (animation, durationMs = 2500) => {
    if (reactionTimer) clearTimeout(reactionTimer)
    set({ animation })
    reactionTimer = setTimeout(() => set({ animation: 'idle' }), durationMs)
  },
  setMotion: ({ moving, fast, facing }) => set({ moving, fast, facing })
}))

/** The animation actually shown: movement takes priority over idle/reactions. */
export function selectDisplayState(state: DuckStore): DuckAnimationState {
  if (state.moving) return state.fast ? 'running' : 'walking'
  return state.animation
}
