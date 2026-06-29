import { nowIso } from '@shared/utils'
import type { DuckProfile } from '@shared/types'
import type { Db } from '../connection'

interface DuckRow {
  id: string
  name: string
  skin: string
  xp: number
  level: number
  accessories: string
}

const SINGLETON_ID = 'local-duck'

export class DuckRepository {
  constructor(private readonly db: Db) {}

  getProfile(): DuckProfile {
    const row = this.db.prepare('SELECT * FROM duck_state WHERE id = ?').get(SINGLETON_ID) as
      | DuckRow
      | undefined
    if (!row) return this.create()
    return {
      id: row.id,
      name: row.name,
      skin: row.skin,
      xp: row.xp,
      level: row.level,
      accessories: JSON.parse(row.accessories) as string[]
    }
  }

  saveProfile(patch: Partial<DuckProfile>): DuckProfile {
    const current = this.getProfile()
    const merged: DuckProfile = { ...current, ...patch }
    this.db
      .prepare(
        `UPDATE duck_state SET name = ?, skin = ?, xp = ?, level = ?, accessories = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        merged.name,
        merged.skin,
        merged.xp,
        merged.level,
        JSON.stringify(merged.accessories),
        nowIso(),
        SINGLETON_ID
      )
    return merged
  }

  private create(): DuckProfile {
    const now = nowIso()
    const profile: DuckProfile = {
      id: SINGLETON_ID,
      name: 'Duck',
      skin: 'classic',
      xp: 0,
      level: 1,
      accessories: []
    }
    this.db
      .prepare(
        `INSERT INTO duck_state (id, user_id, name, skin, xp, level, accessories, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(profile.id, null, profile.name, profile.skin, profile.xp, profile.level, '[]', now, now)
    return profile
  }
}
