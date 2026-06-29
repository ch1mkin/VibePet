# 🦆 VibeDuck — Project Context

> Single source of truth for the VibeDuck desktop application.
> Read this before writing any code. Keep it updated as the project evolves.

---

## 1. What We're Building

VibeDuck is a tiny pixel-art duck that lives on the user's desktop and acts as an
**intelligent AI coding companion** for developers and "vibe coders."

It must feel like a **living desktop companion**, never a chatbot. It walks around,
reacts to what the developer does, plays while AI generates code, and quietly assists.

**Pillars:** Tiny & adorable · Never annoying · Useful before cute · Local-first ·
Smooth 60 FPS · Low memory (<150 MB idle) · Native feel · Cloud only when needed.

---

## 2. Tech Stack

| Layer            | Technology |
|------------------|------------|
| Shell            | Electron |
| UI               | React + TypeScript (strict) |
| Bundler          | Vite (via `electron-vite`) |
| Styling          | Tailwind CSS |
| State            | Zustand |
| Animation        | PixiJS + sprite sheets |
| Local DB         | SQLite via `better-sqlite3` |
| Cloud Backend    | Supabase (Auth, Postgres, Realtime, Storage, RLS) |
| AI               | OpenRouter API (user key, free models, streaming) |
| Packaging        | Electron Builder |

**Hard rules:** Strict TypeScript, no `any`. SOLID. Composition over inheritance.
Small modules, single responsibility. Platform-specific code isolated behind adapters.

---

## 3. Architecture (Clean Architecture)

```
src/
  main/                 # Electron main process (Node)
    index.ts            # App bootstrap, lifecycle
    windows/            # Window factories (duck, panel, settings)
    ipc/                # IPC channel handlers (typed)
    services/           # Business logic (AI, sync, sessions, summaries)
    platform/           # OS adapters (interfaces + win/mac impls)
    database/           # SQLite connection, migrations, repositories
    ai/                 # OpenRouter client, streaming, retries
  preload/              # contextBridge — typed, secure renderer<->main API
  renderer/             # React app (sandboxed UI)
    components/         # Small, reusable components
    features/           # Feature modules (prompt-coach, clipboard, etc.)
    hooks/              # Reusable hooks
    stores/             # Zustand stores
    contexts/           # React contexts
    animations/         # PixiJS duck stage, sprite logic, state machine
    pages/              # Window-level views
    utils/
    assets/             # Sprite sheets, icons
  shared/               # Types & contracts shared across processes
    types/
    ipc-contract.ts     # Single source of IPC channel names + payloads
```

**Process boundaries**
- **Main**: privileged. Owns DB, OS APIs, AI network calls, Supabase service flows.
- **Preload**: thin, typed bridge. No business logic. `contextIsolation: true`.
- **Renderer**: UI only. Never touches Node/OS directly — always via IPC.

**Adapter pattern** — every OS-specific capability sits behind a unified interface so
implementations swap without touching app logic:
`Clipboard`, `Notifications`, `AutoStart`, `FileWatching`, `WindowManagement`,
`GlobalShortcuts`, `SecureStorage`.

> Never put Windows-only code in UI components.
> Never put macOS-specific code in business logic.

---

## 4. Offline-First Data Flow

```
User Action → SQLite (instant) → sync_queue → Background Sync → Supabase
```

- Every write hits **local SQLite first** so the app always feels instant.
- A `sync_queue` table records pending mutations.
- A background sync service flushes the queue to Supabase when authenticated + online.
- Offline: keep working, queue locally, auto-sync on reconnect. **Never lose data.**
- Guest mode = fully local, no cloud. Sign-in unlocks sync.

**Conflict policy (MVP):** last-write-wins via `updated_at`. Revisit later.

---

## 5. Local Database (SQLite)

Tables: `settings`, `clipboard`, `tasks`, `projects`, `prompt_history`, `timeline`,
`achievements`, `duck_state`, `sessions`, `daily_summary`, `sync_queue`.

- Access only through **repositories** in `src/main/database/`.
- All DB access async to the renderer (over IPC); never block the UI.
- Migrations are versioned and run on startup.

---

## 6. Cloud Database (Supabase Postgres)

Tables: `profiles`, `projects`, `tasks`, `prompts`, `clipboard`, `timeline`,
`daily_summary`, `achievements`, `duck_profiles`, `settings`, `project_memory`,
`task_notes`, `ai_sessions`, `prompt_templates`.

Every table includes: `id`, `user_id`, `created_at`, `updated_at`.
**Row Level Security is mandatory on every table** — users access only their own rows.

---

## 7. Security (core requirement)

- RLS enabled on every Supabase table.
- **Never** ship the Supabase Service Role key in the desktop app.
- Store auth tokens in OS secure storage (Keychain on macOS, secure store on Windows).
- Encrypt sensitive values (e.g. OpenRouter API key) before persisting.
- Validate all user input. Auto-refresh sessions, handle expiry gracefully.

---

## 8. The Duck (character & behavior)

Size: 32×32 / 48×48 / 64×64 (max). Occupies a tiny portion of the screen.

**Animation states:** idle, walking, running, sleeping, thinking, coding, happy,
excited, confused, celebrating, eating, drinking coffee, reading docs, flying,
looking around, sitting.

Driven by a **state machine** in `renderer/animations/`. Random idle behaviors fire
every few minutes (look at cursor, sit, nap, coffee, chase butterfly, jump, wave).

**Reactions:** AI generating → types/coffee/excited · copy code → celebrate ·
build success → happy · build fail → sad · idle too long → sleep · task done → confetti.

**Duck Memory** creates attachment: "Yesterday you were fixing authentication",
"You usually use Tailwind", etc. Sourced from project/task memory.

---

## 9. Feature Modules (MVP v1.0)

- Animated Desktop Duck (transparent, click-through optional, always-on-top)
- OpenRouter integration (key, model, temperature, max tokens, streaming, retries)
- **Prompt Coach** (flagship): rewrite prompt + missing context + structure +
  constraints + examples + output format + prompt score
- Prompt Library (history, favorites, categories, tags, search, versions)
- Clipboard Memory (auto-capture, categorize code/commands/urls/prompts/text, pin/fav)
- Task Memory (track tasks, resume unfinished on startup)
- Project Memory (per-project context, goals, bugs, todos, preferred model)
- Timeline (filterable activity stream)
- Daily Summary (hours, tasks, prompts improved, AI requests, streak)
- Context Builder (ready-to-paste AI context from project state)
- Floating Assistant (global shortcut → quick actions panel)
- Supabase Auth + Cloud Sync + Duck Profiles + Achievements + User Accounts

---

## 10. Performance Goals

<150 MB idle · 60 FPS animations · fast startup · no blocking UI ·
async DB · lazy loading · minimal re-renders.

---

## 11. Cross-Platform

Targets: Windows 10/11, macOS Intel + Apple Silicon. Auth providers: Email/Password,
Google, GitHub, Apple (macOS), Guest (offline). All OS differences behind adapters.

---

## 12. Roadmap

- **v1**: Desktop Duck · Prompt Coach · Clipboard · Task Memory · OpenRouter · SQLite · Auth · Sync
- **v2**: VS Code / Cursor / Git integration · Timeline · Achievements
- **v3**: Plugin marketplace · Themes · Duck friends · Cloud sync · Shared library
- **v4**: Local AI models · Voice · Semantic search · MCP · Auto docs

---

## 13. Current Status

**Phase:** MVP scaffolding — foundation builds & runs.

- [x] `context.md`
- [x] Project scaffold (electron-vite, React, TS, Tailwind) — typecheck + build green
- [x] Clean Architecture folders + shared typed IPC contract
- [x] Transparent always-on-top duck window + window manager (duck/panel/settings)
- [x] Platform adapter interfaces + Electron-native implementations + `safeStorage`
- [x] PixiJS duck stage (procedural pixel duck) + idle behavior state machine
- [x] SQLite schema + migrations + repositories (settings/clipboard/tasks/duck/summary)
- [x] OpenRouter client (streaming, retries, timeout) + Prompt Coach service
- [x] Clipboard capture service (auto-categorize) + Floating Assistant panel + Settings UI
- [ ] Sprite-sheet duck animations (replace procedural draw)
- [ ] Supabase auth + cloud sync service + `sync_queue` flushing
- [ ] Remaining feature modules: Prompt Library, Project Memory, Timeline,
      Daily Summary UI, Context Builder, Achievements/gamification
- [ ] Duck Memory surfacing + reactions tied to real editor/build events

### How to run

```bash
npm install     # rebuilds better-sqlite3 for Electron via postinstall
npm run dev     # transparent duck appears bottom-right; Ctrl/Cmd+Shift+D = panel
```

> Update this checklist as work lands. Keep the architecture intact.
