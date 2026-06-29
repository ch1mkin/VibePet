import { useEffect, useState } from 'react'
import { useSpeechStore } from '../stores/speechStore'

const TYPE_SPEED_MS = 28

/**
 * Pixel-art speech bubble that types out whatever the duck wants to say.
 * Renders nothing when there's no active message.
 */
export function DuckSpeech(): JSX.Element | null {
  const message = useSpeechStore((s) => s.message)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!message) {
      setTyped('')
      return
    }
    setTyped('')
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setTyped(message.slice(0, i))
      if (i >= message.length) clearInterval(timer)
    }, TYPE_SPEED_MS)
    return () => clearInterval(timer)
  }, [message])

  if (!message) return null

  const typing = typed.length < message.length

  return (
    // Nudged down so the bubble sits near the duck's head (sprite frames have
    // empty space at the top). Tune the translateY if your sheet differs.
    <div
      className="mb-1 flex w-full justify-center px-2"
      style={{ transform: 'translateY(46px)' }}
    >
      <div className="pixel-bubble bubble-pop">
        {typed}
        {typing && <span className="pixel-caret">&nbsp;</span>}
      </div>
    </div>
  )
}
