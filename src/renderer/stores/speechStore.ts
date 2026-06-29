import { create } from 'zustand'

export type SpeechTone = 'info' | 'happy' | 'tip'

interface SpeechStore {
  message: string | null
  tone: SpeechTone
  /** Show a message for a while; longer text stays up longer. */
  say: (text: string, durationMs?: number, tone?: SpeechTone) => void
  clear: () => void
}

let hideTimer: ReturnType<typeof setTimeout> | null = null

export const useSpeechStore = create<SpeechStore>((set) => ({
  message: null,
  tone: 'info',
  say: (text, durationMs, tone = 'info') => {
    if (hideTimer) clearTimeout(hideTimer)
    const duration = durationMs ?? Math.min(9000, Math.max(3500, text.length * 90))
    set({ message: text, tone })
    hideTimer = setTimeout(() => set({ message: null }), duration)
  },
  clear: () => {
    if (hideTimer) clearTimeout(hideTimer)
    set({ message: null })
  }
}))
