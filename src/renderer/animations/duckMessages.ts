/**
 * Things the duck can say. Kept short so they fit the pixel speech bubble.
 * Sourced here for now; later these can be driven by Duck Memory from the main
 * process via the EvtDuckSay channel ("Yesterday you were fixing auth").
 */
export const GREETINGS = [
  "Hi! I'm your duck 🦆",
  "Let's vibe code!",
  'Ready when you are!',
  'Back to building?',
  'Quack quack, hello! 🦆',
  'Missed me?',
  "Let's ship something today!",
  'Good to see you ✨',
  'Your rubber duck is online.',
  'Reporting for duty! 🫡'
]

export const IDLE_TIPS = [
  'Tip: Cmd+Shift+D opens my panel',
  'Paste a prompt — I can improve it!',
  'I remember everything you copy 📋',
  'Take a sip of water 💧',
  'Small commits, happy duck.',
  'Stuck? Try "Find Bug" in the panel.',
  'Name me in Settings someday!',
  'Stretch those wrists 🪽',
  'Rubber-duck it: explain it to me!',
  'Have you saved your work? 💾',
  'Read the error message twice.',
  'Name things clearly, future-you thanks you.',
  'Tiny PRs review faster.',
  'Tests are notes to your future self.',
  'Blink. Look 20ft away. 👀',
  'Take a deep breath. You got this.',
  'Delete more code than you add today.',
  'Comments explain *why*, not *what*.',
  'Git commit early, commit often.',
  'Have you tried turning it off and on? 🔌',
  'Console.log is a valid debugger.',
  'A walk fixes most bugs. 🚶',
  'Cache invalidation is hard. Be kind.',
  'Off-by-one? Count again. 0,1,2…',
  'Red, green, refactor. ♻️',
  'Premature optimization can wait.',
  'YAGNI: you ain’t gonna need it.',
  'Push to a branch, not to main 😅',
  'Did you handle the empty case?',
  'Null checks save lives.',
  'Snacks are valid debugging fuel. 🍪',
  'Posture check! Sit up. 🪑',
  'Time for a quick break? ☕',
  'One bug at a time.',
  'Reproduce it, then fix it.',
  'Logs over guesses.',
  'Sleep is a feature, not a bug. 😴',
  'Refactor when it’s green.',
  'Pin your dependencies.',
  'Backups: you’ll thank yourself.',
  'Write the docstring first.',
  'Ask me to boost your prompt!',
  'Wanna play? Click me for games 🎮',
  'Catch some bread with me 🍞',
  'Let’s beat your runner high score 🏃',
  'Hydrate or diedrate 💧',
  'Keep functions small and sweet.',
  'A typo is just a feature in disguise.',
  'Future-you is watching. Be nice.',
  'Done is better than perfect.',
  'Touch grass occasionally. 🌱'
]

export const ON_CLIPBOARD = [
  'Copied! Saved that 📋',
  'Got it — stored for you!',
  'Nice snippet! Saved ✨',
  'Tucked that away safely.',
  'Filed under "useful later". 🗂️',
  'Snagged it! 📋',
  'Saved — find it in my panel.',
  'Noted and stored ✅'
]

export const ON_AI_DONE = [
  'Done! ✨',
  'Here you go!',
  'That was fun!',
  'Fresh off the press!',
  'Ta-da! 🎉',
  'Nailed it.',
  'All yours!',
  'Hot and ready 🔥'
]

export const ON_AI_START = [
  'Thinking… 💭',
  'On it!',
  'Cooking something up…',
  'Brewing ideas… ☕',
  'Crunching… 🧠',
  'Let me ponder…'
]

export function pickRandom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}
