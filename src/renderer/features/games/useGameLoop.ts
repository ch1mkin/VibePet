import { useEffect, useRef } from 'react'

/**
 * A requestAnimationFrame loop that calls `cb(dt, now)` each frame with a clamped
 * delta time (seconds). The latest callback is always used without restarting the
 * loop, so games can close over fresh state safely.
 */
export function useGameLoop(cb: (dt: number, now: number) => void, running = true): void {
  const cbRef = useRef(cb)
  cbRef.current = cb

  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const frame = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      cbRef.current(dt, now)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running])
}
