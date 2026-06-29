import { useEffect, useRef, useState } from 'react'
import type { GameId } from '@shared/types'
import { ipc } from '../lib/ipc'
import { useDuckBehavior } from '../hooks/useDuckBehavior'
import { useDuckMotion } from '../hooks/useDuckMotion'
import { useDuckSpeech } from '../hooks/useDuckSpeech'
import { useSpeechStore } from '../stores/speechStore'
import { useDuckStore } from '../stores/duckStore'
import { GREETINGS, IDLE_TIPS, pickRandom } from '../animations/duckMessages'
import { DuckSpeech } from './DuckSpeech'
import { DuckDraftBubble } from './DuckDraftBubble'
import { DuckAvatar } from './DuckAvatar'
import { DuckGameMenu } from './DuckGameMenu'

const DOUBLE_CLICK_MS = 260
const MENU_AUTOCLOSE_MS = 6000
/** Hold the duck down this long to bring up the games menu. */
const HOLD_MS = 650

/**
 * Root of the transparent, click-through duck overlay window.
 *
 * The window ignores mouse events so it never blocks the editor, but the duck's
 * own pixels become interactive on hover (toggling click-through off). Single
 * click → happy; double click → opens the assistant tab.
 */
export function DuckApp(): JSX.Element {
  useDuckBehavior()
  useDuckMotion()
  useDuckSpeech()

  const say = useSpeechStore((s) => s.say)
  const react = useDuckStore((s) => s.react)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heldRef = useRef(false)
  const [draft, setDraft] = useState('')
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.body.classList.add('transparent')
    const offDraft = ipc.on(ipc.channels.EvtDuckDraft, ({ text }) => setDraft(text))
    const offVis = ipc.on(ipc.channels.EvtDuckVisibility, ({ visible }) => {
      setPhase(visible ? 'in' : 'out')
      // Close the game menu if the duck is hiding (e.g. a game just started).
      if (!visible) {
        if (menuTimer.current) {
          clearTimeout(menuTimer.current)
          menuTimer.current = null
        }
        setMenuOpen(false)
        void ipc.invoke(ipc.channels.WindowSetClickThrough, true)
      }
    })
    return () => {
      offDraft()
      offVis()
    }
  }, [])

  const setInteractive = (interactive: boolean): void => {
    // WindowSetClickThrough(true) = ignore mouse; pass `false` to interact.
    void ipc.invoke(ipc.channels.WindowSetClickThrough, !interactive)
  }

  const closeMenu = (): void => {
    if (menuTimer.current) {
      clearTimeout(menuTimer.current)
      menuTimer.current = null
    }
    setMenuOpen(false)
    setInteractive(false)
  }

  const openMenu = (): void => {
    setMenuOpen(true)
    setInteractive(true)
    if (menuTimer.current) clearTimeout(menuTimer.current)
    // Auto-dismiss so the (now mouse-capturing) window doesn't block the desktop.
    menuTimer.current = setTimeout(closeMenu, MENU_AUTOCLOSE_MS)
  }

  const startGame = (game: GameId): void => {
    closeMenu()
    say("let's play! 🎮", 1500, 'happy')
    void ipc.invoke(ipc.channels.GameStart, game)
  }

  // Quick tap → say hi (single) / open the panel (double). A long press is
  // handled separately and opens the games menu.
  const handleTap = (): void => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      closeMenu()
      void ipc.invoke(ipc.channels.PanelToggle)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      if (menuOpen) {
        closeMenu()
        return
      }
      // Friendly tap → wave + a quick message.
      react('greeting', 2200)
      say(pickRandom([...GREETINGS, ...IDLE_TIPS]), 2600, 'happy')
    }, DOUBLE_CLICK_MS)
  }

  const handleMouseDown = (): void => {
    setInteractive(true)
    heldRef.current = false
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null
      heldRef.current = true
      openMenu() // press-and-hold reveals the games
    }, HOLD_MS)
  }

  const handleMouseUp = (): void => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    // If the hold already opened the games menu, don't also treat it as a tap.
    if (heldRef.current) {
      heldRef.current = false
      return
    }
    handleTap()
  }

  const handleMouseLeave = (): void => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (!menuOpen) setInteractive(false)
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    void ipc.invoke(ipc.channels.DuckContextMenu)
  }

  return (
    <div className="pointer-events-none relative flex h-full w-full flex-col items-center justify-end pb-1">
      {menuOpen && <DuckGameMenu onPick={startGame} />}
      {draft.trim() ? <DuckDraftBubble text={draft} /> : <DuckSpeech />}
      <div
        className={`pointer-events-auto cursor-pointer ${
          phase === 'out' ? 'motion-poof' : 'motion-appear'
        }`}
        onMouseEnter={() => setInteractive(true)}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        title="Tap to say hi · hold for games · double-click for the panel · right-click for actions"
      >
        <DuckAvatar />
      </div>
    </div>
  )
}
