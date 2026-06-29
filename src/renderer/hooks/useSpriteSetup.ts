import { useEffect, useState } from 'react'
import { emptySpriteSetup, type SpriteSetup } from '@shared/types'
import { ipc } from '../lib/ipc'

/**
 * Loads the sprite setup (per-action clips + master atlas + ranges) and keeps it
 * live: any change made in Settings is broadcast over `EvtSpriteConfig`, so both
 * the duck and the settings UI update instantly.
 */
export function useSpriteSetup(): SpriteSetup {
  const [setup, setSetup] = useState<SpriteSetup>(emptySpriteSetup)

  useEffect(() => {
    void ipc.invoke(ipc.channels.SpriteGetConfig).then(setSetup)
    return ipc.on(ipc.channels.EvtSpriteConfig, setSetup)
  }, [])

  return setup
}
