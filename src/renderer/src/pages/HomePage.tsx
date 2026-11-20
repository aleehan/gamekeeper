import { useState } from 'react'
import { Feedback } from '../components/Feedback'
import { PendingList } from '../components/PendingList'
import { useAction } from '../hooks/useAction'
import type { AppData } from '../hooks/useAppData'
import { formatClock, formatDateTime, MATCH_FORMS, plural } from '../lib/format'
import { cs2ConnectionText, modeText, TODAY_STATUS_TEXT } from '../lib/labels'

/** Пояснение под статусом. Отдельная функция читается проще, чем вложенные тернарники в JSX. */
function subtitle(today: AppData['today']): string {
  if (today.unlockedUntil !== null) {
    return `Блокировка снята — лимит не действует до ${formatClock(today.unlockedUntil)}`
  }
  switch (today.status) {
    case 'allowed':
      return `Осталось ${today.remaining} ${plural(today.remaining, MATCH_FORMS)} на сегодня`
    case 'grace':
      return today.closeAt ? `CS2 закроется в ${formatClock(today.closeAt)}` : 'CS2 скоро закроется'
    case 'blocked':
      return `Снова можно играть в ${formatClock(today.nextResetAt)}`
  }
}

interface HomePageProps {
  data: AppData
  reload: () => Promise<void>
}

export function HomePage({ data, reload }: HomePageProps): React.JSX.Element {
  const { today, cs2, protection, matches } = data
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()

  const unlockPending = protection.pending.some((c) => c.kind === 'unlock')
  const lastMatch = matches[0] // массив отсортирован: новые сверху

  async function requestUnlock(): Promise<void> {
    const result = await run(() => window.gamekeeper.requestUnlock(password))
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <main className="page">
      <section className={`card today status-${today.status}`}>
        <p className="today-count">
          {today.matchesToday} <span className="muted">из {today.limit}</span>
        </p>
        <p className="today-status">{TODAY_STATUS_TEXT[today.status]}</p>
        <p className="muted">{subtitle(today)}</p>
      </section>

      {today.status !== 'allowed' && !unlockPending && (
        <section className="card form">
          <h3>Снять блокировку</h3>
          <p className="muted small">
            Разрешит играть без лимита до 05:00. Вступит в силу через 10 минут после подтверждения
            паролем.
          </p>
          <div className="row">
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button disabled={busy || !password} onClick={() => void requestUnlock()}>
              Запросить
            </button>
          </div>
          <Feedback value={feedback} />
        </section>
      )}

      <PendingList
        items={protection.pending}
        onCancel={(id) => void window.gamekeeper.cancelPending(id).then(reload)}
      />

      <section className="card">
        <h3>CS2</h3>
        <p>{cs2ConnectionText(cs2)}</p>
        {lastMatch && (
          <p className="muted">
            Последняя катка: {lastMatch.map}, {modeText(lastMatch.mode)}, {lastMatch.ctScore ?? '?'}
            :{lastMatch.tScore ?? '?'} — {formatDateTime(lastMatch.finishedAt)}
          </p>
        )}
      </section>
    </main>
  )
}
