/// <reference types="vite/client" />
import type { VibeDuckBridge } from '@shared/bridge'

declare global {
  interface Window {
    vibeduck: VibeDuckBridge
  }
}

export {}
