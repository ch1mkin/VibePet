/**
 * Controls when the duck is allowed to appear. The duck only shows while a
 * "coding" or AI app is in the foreground (editors, AI desktop apps, or AI
 * websites in a browser). Fully user-configurable.
 */
export interface VisibilityConfig {
  /** Master switch. When false, the duck is always visible. */
  enabled: boolean
  /** App/process names that should show the duck (case-insensitive substring). */
  apps: string[]
  /** Browser app names whose active tab URL / title is inspected for AI sites. */
  browsers: string[]
  /** Domains (substring match on URL) that count as AI sites. */
  domains: string[]
  /** Window-title keywords (case-insensitive substring) that count as AI sites. */
  titleKeywords: string[]
}

export const DEFAULT_VISIBILITY: VisibilityConfig = {
  enabled: true,
  apps: [
    'Cursor',
    'Code',
    'Visual Studio Code',
    'VSCodium',
    'Windsurf',
    'Claude',
    'Zed',
    'Xcode',
    'IntelliJ IDEA',
    'WebStorm',
    'PyCharm',
    'Sublime Text',
    'Android Studio',
    'Terminal',
    'iTerm2',
    'Warp',
    'Ghostty',
    'Alacritty',
    'kitty',
    'WezTerm',
    'Hyper',
    'WindowsTerminal',
    'devenv',
    'idea64',
    'pycharm64',
    'webstorm64',
    'Electron',
    'VibeDuck'
  ],
  browsers: [
    'Safari',
    'Google Chrome',
    'Google Chrome Canary',
    'Brave Browser',
    'Microsoft Edge',
    'Arc',
    'Chromium',
    'Vivaldi',
    'Opera',
    'Dia',
    'Zen',
    'firefox',
    'chrome',
    'msedge',
    'brave'
  ],
  domains: [
    'chatgpt.com',
    'chat.openai.com',
    'gemini.google.com',
    'bard.google.com',
    'claude.ai',
    'copilot.microsoft.com',
    'perplexity.ai',
    'x.ai',
    'grok.com',
    'v0.dev',
    'bolt.new',
    'lovable.dev',
    'cursor.com'
  ],
  titleKeywords: [
    'ChatGPT',
    'Gemini',
    'Claude',
    'Copilot',
    'Perplexity',
    'Grok',
    'Bard',
    'OpenAI'
  ]
}
