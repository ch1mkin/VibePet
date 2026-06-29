import { useEffect } from 'react'
import type { DuckAnimationState } from '@shared/types'
import { ipc } from '../lib/ipc'
import { useDuckStore } from '../stores/duckStore'
import { pickIdleBehavior } from '../animations/idleBehaviors'

/**
 * Drives the duck's "always alive" loop: cycles random idle behaviors and reacts
 * to push events from the main process (clipboard capture, AI activity, etc.).
 */
export function useDuckBehavior(): void {
  const setAnimation = useDuckStore((s) => s.setAnimation)
  const react = useDuckStore((s) => s.react)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const scheduleIdle = (): void => {
      const behavior = pickIdleBehavior()
      setAnimation(behavior.state)
      timer = setTimeout(scheduleIdle, behavior.durationMs)
    }
    scheduleIdle()

    const offBehavior = ipc.on(ipc.channels.EvtDuckBehavior, ({ behavior }) => {
      react(behavior as DuckAnimationState)
    })
    const offClipboard = ipc.on(ipc.channels.EvtClipboardCaptured, () => {
      react('celebrating')
    })
    const offStream = ipc.on(ipc.channels.EvtAIStream, (chunk) => {
      react(chunk.done ? 'happy' : 'coding', chunk.done ? 2000 : 1500)
    })

    return () => {
      clearTimeout(timer)
      offBehavior()
      offClipboard()
      offStream()
    }
  }, [setAnimation, react])
}
