# 🦆 VibeDuck

A tiny pixel-art duck that lives on your desktop and acts as an intelligent AI coding
companion for developers. It roams your screen, only shows up in your coding/AI apps,
remembers everything you copy, boosts your prompts, and even has mini-games to play
between code generations. See [`context.md`](./context.md) for the full vision.

---

## ✨ Features

- **Living desktop pet** — a transparent, always-on-top duck that roams, reacts, and
  speaks in a pixel-art speech bubble.
- **Context-aware** — only appears when you're in coding/AI apps (Cursor, VS Code,
  ChatGPT, Claude, Gemini, etc.).
- **Prompt Boost** — type a prompt, and the duck rewrites it for better results before
  sending (toggleable).
- **Clipboard memory** — every copy/paste is stored locally (offline-first) with an
  instant copy-back button; images supported too.
- **AI tools** — Prompt Coach, Find Bug, and more via [OpenRouter](https://openrouter.ai)
  (bring your own key; free models supported, custom model names allowed).
- **Custom looks** — upload per-action sprite sheets, one master atlas (drag-select
  frame ranges), or a single duck image to replace the emoji.
- **Mini-games** — **Bread Catch** and **Endless Runner**, played as a transparent
  overlay so you can still see your code behind them. Custom game art supported.
- **Optional cloud sync** — Supabase auth + Postgres with offline-first background sync.

---

## 🧰 Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | [Electron 32](https://www.electronjs.org/) |
| UI | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build / dev | [electron-vite](https://electron-vite.org/) + [Vite 5](https://vitejs.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + `Press Start 2P` pixel font |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| Local database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (offline-first) |
| Cloud (optional) | [Supabase](https://supabase.com/) (Auth + Postgres + RLS) via `@supabase/supabase-js` + `ws` |
| AI | [OpenRouter](https://openrouter.ai) API |
| Secure storage | Electron `safeStorage` (OS keychain) |
| Packaging | [electron-builder](https://www.electron.build/) |
| Image processing | [sharp](https://sharp.pixelplumbing.com/) (icons + game assets) |

**Architecture:** Clean Architecture across three Electron processes
(`main` / `preload` / `renderer`) with a shared, typed IPC contract. OS-specific
behavior is isolated behind platform adapters. Every write hits local SQLite first,
then syncs to Supabase in the background.

```
src/
  main/       # Electron main: windows, ipc, services, platform, database, ai
  preload/    # typed contextBridge
  renderer/   # React UI: components, features, hooks, stores, animations
  shared/     # types + ipc-contract shared across processes
```

---

## 📦 Install (prebuilt app)

### macOS

1. Download `VibeDuck-<version>.dmg` (Apple Silicon / Intel) from the release.
2. Open the `.dmg` and drag **VibeDuck** into **Applications**.
3. The app is **not code-signed**, so the first launch needs a one-time approval:
   - Right-click **VibeDuck.app → Open**, then click **Open** in the dialog, **or**
   - If macOS blocks it, run:
     ```bash
     xattr -dr com.apple.quarantine /Applications/VibeDuck.app
     ```
4. On first run, grant the permissions below so the duck can be context-aware.

> **macOS permissions** (System Settings → Privacy & Security):
> - **Accessibility** — to read/insert text in prompt boxes (Prompt Boost) and detect the focused app.
> - **Screen Recording** *(only if prompted)* — used by some macOS versions to read the active window title.

### Windows

1. Download `VibeDuck-Setup-<version>.exe` from the release.
2. Run the installer. SmartScreen may warn because the app is unsigned — click
   **More info → Run anyway**.
3. Launch **VibeDuck** from the Start menu.

---

## 🛠️ Build from source

### Requirements

- **Node.js 20+**
- macOS (Intel / Apple Silicon) or Windows 10/11

### Develop

```bash
npm install        # installs deps and rebuilds native modules for Electron
npm run dev        # launches the duck overlay with HMR
```

> A transparent, always-on-top duck appears on your primary display. Click it for
> games, double-click for the assistant, and press **Ctrl/Cmd + Shift + D** to toggle
> the Floating Assistant.

### Package an installer

```bash
npm run package:mac    # builds a .dmg (macOS)
npm run package:win    # builds an .exe installer (Windows)
npm run package        # builds for the current OS
```

Output lands in `dist/`. Build the macOS app **on a Mac** and the Windows app **on
Windows** (electron-builder doesn't reliably cross-compile native modules).

---

## ⚙️ Configuration

- **AI:** open **Settings** (duck menu / tray) and add your
  [OpenRouter](https://openrouter.ai) API key. The key is encrypted at rest via the OS
  keychain. You can type any model name (e.g. a free `:free` model).
- **Cloud sync (optional):** copy `.env.example` to `.env` and fill in your Supabase
  project URL and anon key. Run the SQL in [`supabase/migrations`](./supabase/migrations)
  to set up the auth-linked tables, RLS, and triggers.

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run in development with HMR |
| `npm run build` | Type-check and build all processes |
| `npm run typecheck` | Type-check main + renderer |
| `npm run lint` | ESLint |
| `npm run package` | Build a distributable (current OS) |
| `npm run package:mac` / `:win` | Build for a specific OS |

---

## License

MIT
