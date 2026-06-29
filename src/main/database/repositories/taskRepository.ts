import { newId, nowIso } from '@shared/utils'
import type { Task, TaskStatus } from '@shared/types'
import type { Db } from '../connection'

interface TaskRow {
  id: string
  user_id: string | null
  name: string
  status: string
  started_at: string
  ended_at: string | null
  duration_ms: number
  prompt_used: string | null
  notes: string | null
  project_id: string | null
  created_at: string
  updated_at: string
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status as TaskStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    promptUsed: row.prompt_used,
    notes: row.notes,
    projectId: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class TaskRepository {
  constructor(private readonly db: Db) {}

  unfinished(): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks WHERE status IN ('active', 'interrupted')
         ORDER BY started_at DESC`
      )
      .all() as TaskRow[]
    return rows.map(toTask)
  }

  start(name: string): Task {
    const now = nowIso()
    const task: Task = {
      id: newId(),
      userId: null,
      name,
      status: 'active',
      startedAt: now,
      endedAt: null,
      durationMs: 0,
      promptUsed: null,
      notes: null,
      projectId: null,
      createdAt: now,
      updatedAt: now
    }
    this.db
      .prepare(
        `INSERT INTO tasks (id, user_id, name, status, started_at, ended_at, duration_ms,
           prompt_used, notes, project_id, created_at, updated_at)
         VALUES (@id, @userId, @name, @status, @startedAt, @endedAt, @durationMs,
           @promptUsed, @notes, @projectId, @createdAt, @updatedAt)`
      )
      .run(task)
    return task
  }

  update(patch: Partial<Task> & { id: string }): Task {
    const existing = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(patch.id) as
      | TaskRow
      | undefined
    if (!existing) throw new Error(`Task not found: ${patch.id}`)
    const merged = { ...toTask(existing), ...patch, updatedAt: nowIso() }
    this.db
      .prepare(
        `UPDATE tasks SET name = @name, status = @status, started_at = @startedAt,
           ended_at = @endedAt, duration_ms = @durationMs, prompt_used = @promptUsed,
           notes = @notes, project_id = @projectId, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run(merged)
    return merged
  }
}
