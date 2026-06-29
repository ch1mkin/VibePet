import { join } from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { MIGRATIONS } from './schema'

export type Db = Database.Database

let db: Db | null = null

/**
 * Opens (and memoizes) the local SQLite database, applying any pending migrations.
 * WAL mode keeps reads fast and non-blocking while a write is in flight.
 */
export function getDatabase(): Db {
  if (db) return db

  const file = join(app.getPath('userData'), 'vibeduck.sqlite')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

function runMigrations(database: Db): void {
  database.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );`
  )

  const applied = new Set(
    database
      .prepare('SELECT version FROM _migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  )

  const insert = database.prepare(
    'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)'
  )

  const pending = MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version
  )

  for (const migration of pending) {
    const tx = database.transaction(() => {
      database.exec(migration.sql)
      insert.run(migration.version, migration.name, new Date().toISOString())
    })
    tx()
  }
}

export function closeDatabase(): void {
  db?.close()
  db = null
}
