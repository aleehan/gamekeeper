import { count, desc, gte } from 'drizzle-orm'
import type { Db } from './database'
import { matches, type Match, type NewMatch } from './schema'

export function insertMatch(db: Db, match: NewMatch): Match {
  return db.insert(matches).values(match).returning().get()
}

/** Сколько каток завершено начиная с момента `since` (например, с 05:00 сегодня). */
export function countMatchesSince(db: Db, since: Date): number {
  const row = db
    .select({ value: count() })
    .from(matches)
    .where(gte(matches.finishedAt, since))
    .get()
  // `??` — «если слева null/undefined, взять справа».
  return row?.value ?? 0
}

/** Последние катки для страницы «История», новые сверху. */
export function listRecentMatches(db: Db, limit = 100): Match[] {
  return db.select().from(matches).orderBy(desc(matches.finishedAt)).limit(limit).all()
}
