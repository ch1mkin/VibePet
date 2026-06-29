import { getDatabase } from './connection'
import { ClipboardRepository } from './repositories/clipboardRepository'
import { DuckRepository } from './repositories/duckRepository'
import { SettingsRepository } from './repositories/settingsRepository'
import { SummaryRepository } from './repositories/summaryRepository'
import { TaskRepository } from './repositories/taskRepository'

export * from './connection'

export interface Repositories {
  settings: SettingsRepository
  clipboard: ClipboardRepository
  tasks: TaskRepository
  duck: DuckRepository
  summary: SummaryRepository
}

let repositories: Repositories | null = null

/** Lazily constructs the repository layer over a single shared DB connection. */
export function getRepositories(): Repositories {
  if (repositories) return repositories
  const db = getDatabase()
  repositories = {
    settings: new SettingsRepository(db),
    clipboard: new ClipboardRepository(db),
    tasks: new TaskRepository(db),
    duck: new DuckRepository(db),
    summary: new SummaryRepository(db)
  }
  return repositories
}
