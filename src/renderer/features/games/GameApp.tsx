import { useEffect } from 'react'
import type { GameId } from '@shared/types'
import { ipc } from '../../lib/ipc'
import { BreadCatch } from './BreadCatch'
import { EndlessRunner } from './EndlessRunner'
import { PixelButton } from './Hud'

function currentGame(): GameId {
  const param = new URLSearchParams(window.location.search).get('game')
  return param === 'runner' ? 'runner' : 'breadCatch'
}

/**
 * Root of the full-screen game overlay window. Picks the game from the `?game=`
 * query the main process passes in, and owns the universal exit (Stop / ESC),
 * which closes this window and hands the screen back to the duck.
 */
export function GameApp(): JSX.Element {
  const game = currentGame()

  const exit = (): void => {
    void ipc.invoke(ipc.channels.GameStop)
  }

  useEffect(() => {
    // Keep the window see-through so the user can watch their code behind the game.
    document.body.classList.add('transparent')
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="game-fade fixed inset-0 overflow-hidden">
      {game === 'runner' ? <EndlessRunner onExit={exit} /> : <BreadCatch onExit={exit} />}

      <div className="absolute right-4 top-4 z-20">
        <PixelButton variant="danger" onClick={exit}>
          ✕ Stop
        </PixelButton>
      </div>
    </div>
  )
}
