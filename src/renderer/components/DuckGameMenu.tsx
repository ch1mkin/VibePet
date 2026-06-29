import { GAMES, type GameId } from '@shared/types'

/**
 * Small pixel popup shown above the duck when it's clicked, letting the user
 * launch a mini-game.
 */
export function DuckGameMenu({ onPick }: { onPick: (game: GameId) => void }): JSX.Element {
  return (
    <div className="pointer-events-auto absolute bottom-[150px] left-1/2 z-20 w-[184px] -translate-x-1/2 bubble-pop">
      <div className="pixel-panel p-2">
        <p className="px-1 pb-2 font-pixel text-[8px] text-duck-yellow">PLAY A GAME</p>
        <div className="flex flex-col gap-1.5">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              className="pixel-btn !px-2 !py-2 text-left !text-[9px] leading-relaxed"
              onClick={(e) => {
                e.stopPropagation()
                onPick(g.id)
              }}
            >
              <span className="mr-1.5">{g.emoji}</span>
              {g.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
