/**
 * Versioned SQLite migrations. Each entry runs once, in order, tracked by
 * the `_migrations` table. Never edit a shipped migration — append a new one.
 */
export interface Migration {
  version: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: /* sql */ `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clipboard (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'text',
        pinned INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_clipboard_created ON clipboard(created_at DESC);

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        prompt_used TEXT,
        notes TEXT,
        project_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        folder TEXT NOT NULL,
        framework TEXT,
        languages TEXT NOT NULL DEFAULT '[]',
        libraries TEXT NOT NULL DEFAULT '[]',
        architecture_notes TEXT,
        folder_structure TEXT,
        coding_style TEXT,
        current_goal TEXT,
        known_bugs TEXT NOT NULL DEFAULT '[]',
        todo_list TEXT NOT NULL DEFAULT '[]',
        preferred_model TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prompt_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        original TEXT NOT NULL,
        improved TEXT,
        category TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        favorite INTEGER NOT NULL DEFAULT 0,
        score INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS timeline (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        key TEXT NOT NULL,
        unlocked_at TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        target INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS duck_state (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL DEFAULT 'Duck',
        skin TEXT NOT NULL DEFAULT 'classic',
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        accessories TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_summary (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        date TEXT NOT NULL,
        hours_coded REAL NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        prompts_improved INTEGER NOT NULL DEFAULT 0,
        ai_requests INTEGER NOT NULL DEFAULT 0,
        clipboard_items INTEGER NOT NULL DEFAULT 0,
        lines_generated INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date);

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT
      );
    `
  }
]
