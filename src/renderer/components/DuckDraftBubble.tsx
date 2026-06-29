const MAX_CHARS = 110

/**
 * A chat/"texting" style bubble that mirrors what the user is typing into their
 * AI prompt box (shown while Prompt Boost is on). Purely presentational —
 * `DuckApp` feeds it the live draft text.
 */
export function DuckDraftBubble({ text }: { text: string }): JSX.Element {
  const trimmed = text.length > MAX_CHARS ? `…${text.slice(-MAX_CHARS)}` : text
  // The blinking caret only makes sense while mirroring live typing — not for
  // Prompt Boost status messages ("thinking…", "copied & added…").
  const isStatus =
    text.includes('✓') || text.includes('💭') || text.includes('✨') || text.includes('\n')

  return (
    <div
      className="mb-1 flex w-full justify-center px-2"
      style={{ transform: 'translateY(40px)' }}
    >
      <div className="text-bubble bubble-pop">
        {trimmed}
        {!isStatus && <span className="text-caret" />}
      </div>
    </div>
  )
}
