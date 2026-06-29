import { useEffect } from 'react'
import { ipc } from '../lib/ipc'
import { useDuckStore } from '../stores/duckStore'

/** Subscribes to main-process motion updates (walking toward the cursor). */
export function useDuckMotion(): void {
  const setMotion = useDuckStore((s) => s.setMotion)
  useEffect(() => ipc.on(ipc.channels.EvtDuckMotion, setMotion), [setMotion])
}
