import { useEffect } from 'react'
import { ipc } from '../lib/ipc'
import { useSpeechStore } from '../stores/speechStore'
import { useDuckStore } from '../stores/duckStore'
import {
  GREETINGS,
  IDLE_TIPS,
  ON_AI_DONE,
  ON_AI_START,
  ON_CLIPBOARD,
  pickRandom
} from '../animations/duckMessages'

const FIRST_GREETING_MS = 1200
const IDLE_MIN_MS = 90_000
const IDLE_MAX_MS = 180_000

/**
 * Decides what the duck says: a greeting on launch, occasional idle tips, and
 * reactions to events (clipboard capture, AI activity). Also relays any
 * main-process EvtDuckSay messages (e.g. future Duck Memory recollections).
 */
export function useDuckSpeech(): void {
  const say = useSpeechStore((s) => s.say)
  const react = useDuckStore((s) => s.react)

  useEffect(() => {
    const greeting = setTimeout(() => {
      // Play the "Hi" wave animation alongside the greeting message.
      react('greeting', 2600)
      say(pickRandom(GREETINGS), undefined, 'happy')
    }, FIRST_GREETING_MS)

    let idleTimer: ReturnType<typeof setTimeout>
    const scheduleIdle = (): void => {
      const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS)
      idleTimer = setTimeout(() => {
        say(pickRandom(IDLE_TIPS), undefined, 'tip')
        scheduleIdle()
      }, delay)
    }
    scheduleIdle()

    const offClipboard = ipc.on(ipc.channels.EvtClipboardCaptured, () => {
      say(pickRandom(ON_CLIPBOARD), undefined, 'happy')
    })
    const offStream = ipc.on(ipc.channels.EvtAIStream, (chunk) => {
      say(pickRandom(chunk.done ? ON_AI_DONE : ON_AI_START), undefined, chunk.done ? 'happy' : 'info')
    })
    const offSay = ipc.on(ipc.channels.EvtDuckSay, ({ text, durationMs, tone }) => {
      say(text, durationMs, tone)
    })

    return () => {
      clearTimeout(greeting)
      clearTimeout(idleTimer)
      offClipboard()
      offStream()
      offSay()
    }
  }, [say, react])
}
