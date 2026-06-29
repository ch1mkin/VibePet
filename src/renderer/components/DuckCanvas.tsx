import { useEffect, useRef } from 'react'
import { useDuckStore } from '../stores/duckStore'
import { DuckStage } from '../animations/DuckStage'

/** Mounts the PixiJS DuckStage and keeps it in sync with the animation store. */
export function DuckCanvas(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<DuckStage | null>(null)
  const animation = useDuckStore((s) => s.animation)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const stage = new DuckStage()
    stageRef.current = stage
    let disposed = false
    void stage.mount(container).then(() => {
      if (disposed) stage.destroy()
    })

    const onResize = (): void => stage.resize()
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      stage.destroy()
      stageRef.current = null
    }
  }, [])

  useEffect(() => {
    stageRef.current?.setState(animation)
  }, [animation])

  return <div ref={containerRef} className="h-full w-full" />
}
