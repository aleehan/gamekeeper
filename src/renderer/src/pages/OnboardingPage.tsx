import { useState, type FormEvent } from 'react'
import { MATCH_LIMIT_MAX, MATCH_LIMIT_MIN } from '../../../shared/protection'
import { Feedback } from '../components/Feedback'
import { useAction } from '../hooks/useAction'

// Array.from({ length: n }, (_, i) => ...) — создаёт массив [1, 2, ..., 10].
const LIMIT_OPTIONS = Array.from(
  { length: MATCH_LIMIT_MAX - MATCH_LIMIT_MIN + 1 },
  (_, i) => MATCH_LIMIT_MIN + i
)

/** Первый запуск: пароль и лимит. Пока пароль не задан, остальные экраны недоступны. */
export function OnboardingPage({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [limit, setLimit] = useState(3)
  const [localError, setLocalError] = useState<string | null>(null)
  const { feedback, busy, run } = useAction()

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (password !== confirm) {
      setLocalError('Пароли не совпадают.')
      return
    }
    setLocalError(null)
    const result = await run(() => window.gamekeeper.setInitialPassword(password, limit))
    if (result.ok) onDone()
  }

  return (
    <main className="page narrow">
      <h1>Gamekeeper</h1>
      <p className="muted">
        Приложение считает соревновательные катки в CS2 и закрывает игру, когда дневной лимит
        исчерпан. Счётчик сбрасывается каждый день в 05:00.
      </p>

      <form className="card form" onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span>Сколько каток в день разрешить?</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Пароль ещё раз</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>

        <p className="muted small">
          Пароль понадобится, чтобы увеличить лимит, снять блокировку или выйти из приложения — и
          даже с паролем эти изменения вступают в силу только через 10 минут. Уменьшить лимит можно
          в любой момент без пароля. Восстановить пароль нельзя.
        </p>

        <button type="submit" className="primary" disabled={busy || password.length === 0}>
          Начать
        </button>
        {localError && <p className="feedback error">{localError}</p>}
        <Feedback value={feedback} />
      </form>
    </main>
  )
}
