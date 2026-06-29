import { newId, nowIso } from '@shared/utils'
import type { ClipboardCategory, ClipboardItem } from '@shared/types'
import type { Db } from '../connection'

interface ClipboardRow {
  id: string
  user_id: string | null
  content: string
  category: string
  pinned: number
  favorite: number
  created_at: string
  updated_at: string
}

function toItem(row: ClipboardRow): ClipboardItem {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    category: row.category as ClipboardCategory,
    pinned: row.pinned === 1,
    favorite: row.favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ClipboardRepository {
  constructor(private readonly db: Db) {}

  list(query?: string): ClipboardItem[] {
    const rows = query
      ? (this.db
          .prepare(
            `SELECT * FROM clipboard WHERE content LIKE ?
             ORDER BY pinned DESC, created_at DESC LIMIT 200`
          )
          .all(`%${query}%`) as ClipboardRow[])
      : (this.db
          .prepare('SELECT * FROM clipboard ORDER BY pinned DESC, created_at DESC LIMIT 200')
          .all() as ClipboardRow[])
    return rows.map(toItem)
  }

  save(partial: Partial<ClipboardItem>): ClipboardItem {
    const now = nowIso()
    const item: ClipboardItem = {
      id: partial.id ?? newId(),
      userId: partial.userId ?? null,
      content: partial.content ?? '',
      category: partial.category ?? 'text',
      pinned: partial.pinned ?? false,
      favorite: partial.favorite ?? false,
      createdAt: partial.createdAt ?? now,
      updatedAt: now
    }
    this.db
      .prepare(
        `INSERT INTO clipboard (id, user_id, content, category, pinned, favorite, created_at, updated_at)
         VALUES (@id, @userId, @content, @category, @pinned, @favorite, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           content = excluded.content, category = excluded.category,
           pinned = excluded.pinned, favorite = excluded.favorite, updated_at = excluded.updated_at`
      )
      .run({
        ...item,
        pinned: item.pinned ? 1 : 0,
        favorite: item.favorite ? 1 : 0
      })
    return item
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM clipboard WHERE id = ?').run(id)
  }
}
