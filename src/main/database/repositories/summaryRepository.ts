import { newId, nowIso } from '@shared/utils'
import type { DailySummary } from '@shared/types'
import type { Db } from '../connection'

interface SummaryRow {
  id: string
  user_id: string | null
  date: string
  hours_coded: number
  tasks_completed: number
  prompts_improved: number
  ai_requests: number
  clipboard_items: number
  lines_generated: number
  streak: number
  created_at: string
  updated_at: string
}

function toSummary(row: SummaryRow): DailySummary {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    hoursCoded: row.hours_coded,
    tasksCompleted: row.tasks_completed,
    promptsImproved: row.prompts_improved,
    aiRequests: row.ai_requests,
    clipboardItems: row.clipboard_items,
    linesGenerated: row.lines_generated,
    streak: row.streak,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class SummaryRepository {
  constructor(private readonly db: Db) {}

  today(): DailySummary {
    const date = new Date().toISOString().slice(0, 10)
    const row = this.db.prepare('SELECT * FROM daily_summary WHERE date = ?').get(date) as
      | SummaryRow
      | undefined
    if (row) return toSummary(row)

    const now = nowIso()
    const summary: DailySummary = {
      id: newId(),
      userId: null,
      date,
      hoursCoded: 0,
      tasksCompleted: 0,
      promptsImproved: 0,
      aiRequests: 0,
      clipboardItems: 0,
      linesGenerated: 0,
      streak: 0,
      createdAt: now,
      updatedAt: now
    }
    this.db
      .prepare(
        `INSERT INTO daily_summary (id, user_id, date, hours_coded, tasks_completed,
           prompts_improved, ai_requests, clipboard_items, lines_generated, streak,
           created_at, updated_at)
         VALUES (@id, @userId, @date, @hoursCoded, @tasksCompleted, @promptsImproved,
           @aiRequests, @clipboardItems, @linesGenerated, @streak, @createdAt, @updatedAt)`
      )
      .run(summary)
    return summary
  }
}
