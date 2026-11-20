import type { MatchRecord } from '../../../shared/ipc'
import type { AppData } from '../hooks/useAppData'
import { formatClock, formatDay, MATCH_FORMS, plural } from '../lib/format'
import { modeText } from '../lib/labels'

interface DayGroup {
  gameDay: number
  matches: MatchRecord[]
}

/** Группирует катки по игровому дню. Вход отсортирован по убыванию времени — порядок сохраняется. */
function groupByDay(matches: MatchRecord[]): DayGroup[] {
  // Map сохраняет порядок вставки ключей, поэтому дни останутся от новых к старым.
  const groups = new Map<number, MatchRecord[]>()
  for (const match of matches) {
    const list = groups.get(match.gameDay)
    if (list) list.push(match)
    else groups.set(match.gameDay, [match])
  }
  // Array.from(map, fn) превращает пары [ключ, значение] в массив объектов.
  return Array.from(groups, ([gameDay, list]) => ({ gameDay, matches: list }))
}

export function HistoryPage({ data }: { data: AppData }): React.JSX.Element {
  const groups = groupByDay(data.matches)

  if (groups.length === 0) {
    return (
      <main className="page">
        <section className="card">
          <p className="muted">Засчитанных каток пока нет.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      {groups.map((group) => (
        <section className="card" key={group.gameDay}>
          <h3>
            {formatDay(group.gameDay)}{' '}
            <span className="muted">
              — {group.matches.length} {plural(group.matches.length, MATCH_FORMS)}
            </span>
          </h3>
          <table className="matches-table">
            <tbody>
              {group.matches.map((m) => (
                <tr key={m.id}>
                  <td className="muted">{formatClock(m.finishedAt)}</td>
                  <td>{m.map}</td>
                  <td>{modeText(m.mode)}</td>
                  <td className="score">
                    {m.ctScore ?? '?'}:{m.tScore ?? '?'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="muted small">
        Всего показано: {data.matches.length} {plural(data.matches.length, MATCH_FORMS)}. Игровой
        день начинается в 05:00.
      </p>
    </main>
  )
}
