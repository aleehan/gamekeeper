import { useEffect, useState, type FormEvent } from 'react'
import type { PendingChangeInfo, ProtectionState } from '../../../shared/ipc'
import type { ActionResult, ProtectionError } from '../../../shared/protection'

const ERROR_TEXT: Record<ProtectionError, string> = {
  'password-not-set': 'Сначала задай пароль.',
  'password-already-set': 'Пароль уже задан.',
  'wrong-password': 'Неверный пароль.',
  'password-too-short': 'Пароль слишком короткий (минимум 4 символа).',
  'invalid-value': 'Недопустимое значение.',
  unchanged: 'Значение не изменилось.'
}

function describePending(change: PendingChangeInfo): string {
  switch (change.kind) {
    case 'raise_limit':
      return `Лимит → ${change.value} каток`
    case 'raise_close_delay':
      return `Задержка закрытия → ${change.value} с`
    case 'unlock':
      return 'Снятие блокировки до 05:00'
    case 'quit':
      return 'Выход из Gamekeeper'
  }
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  // padStart(2, '0') — дополняет строку нулями слева до 2 символов: 5 → "05".
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function resultText(result: ActionResult): string {
  if (!result.ok) return ERROR_TEXT[result.error]
  // После проверки result.ok TS знает, что тут вариант с полем applied.
  return result.applied === 'now'
    ? 'Готово.'
    : 'Принято. Изменение вступит в силу через 10 минут — его можно отменить.'
}

/**
 * Временная панель управления защитой (этап 5).
 * На этапе 6 её содержимое переедет на страницу «Настройки».
 */
export function ProtectionPanel(): React.JSX.Element {
  const [state, setState] = useState<ProtectionState | null>(null)
  const [password, setPassword] = useState('')
  const [limit, setLimit] = useState(3)
  const [message, setMessage] = useState<string | null>(null)
  // Ленивый инициализатор: функция вызывается один раз при создании компонента,
  // а не на каждом рендере (рендер должен быть «чистым»).
  const [now, setNow] = useState(() => Date.now())

  async function reload(): Promise<void> {
    setState(await window.gamekeeper.getProtectionState())
  }

  useEffect(() => {
    // Флаг отмены: если компонент исчез до ответа, не трогаем его состояние.
    let cancelled = false
    const load = async (initial: boolean): Promise<void> => {
      const next = await window.gamekeeper.getProtectionState()
      if (cancelled) return
      setState(next)
      if (initial) setLimit(next.matchLimit)
    }

    void load(true)
    const timer = setInterval(() => {
      setNow(Date.now())
      void load(false)
    }, 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // Общая обёртка для действий: показать результат, очистить пароль, обновить состояние.
  async function run(action: () => Promise<ActionResult>): Promise<void> {
    const result = await action()
    setMessage(resultText(result))
    if (result.ok) setPassword('')
    await reload()
  }

  function onSetPassword(event: FormEvent): void {
    // Без preventDefault форма перезагрузила бы страницу.
    event.preventDefault()
    void run(() => window.gamekeeper.setInitialPassword(password))
  }

  if (state === null) return <p>Загрузка…</p>

  if (!state.hasPassword) {
    return (
      <form className="panel" onSubmit={onSetPassword}>
        <p>
          Задай пароль. Без него нельзя будет поднять лимит, снять блокировку или выйти из
          приложения.
        </p>
        <input
          type="password"
          placeholder="Новый пароль"
          value={password}
          // onChange срабатывает на каждый ввод; e.target.value — текущий текст поля.
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Сохранить пароль</button>
        {message && <p className="hint">{message}</p>}
      </form>
    )
  }

  const isLoosening = limit > state.matchLimit

  return (
    <div className="panel">
      <div className="row">
        <label>
          Лимит каток в день:{' '}
          <input
            type="number"
            min={1}
            max={10}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <button
          onClick={() =>
            void run(() =>
              window.gamekeeper.setMatchLimit(limit, isLoosening ? password : undefined)
            )
          }
        >
          {isLoosening ? 'Запросить увеличение' : 'Сохранить'}
        </button>
        <span className="hint">сейчас: {state.matchLimit}</span>
      </div>

      <div className="row">
        <input
          type="password"
          placeholder="Пароль (для ослабления)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={() => void run(() => window.gamekeeper.requestUnlock(password))}>
          Снять блокировку
        </button>
        <button onClick={() => void run(() => window.gamekeeper.requestQuit(password))}>
          Выйти из Gamekeeper
        </button>
      </div>

      {message && <p className="hint">{message}</p>}

      {state.pending.length > 0 && (
        <>
          <h3>Ожидают применения</h3>
          <ul className="pending">
            {state.pending.map((change) => (
              <li key={change.id}>
                {describePending(change)} — через {formatCountdown(change.applyAt - now)}{' '}
                <button
                  onClick={() => void window.gamekeeper.cancelPending(change.id).then(reload)}
                >
                  Отменить
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
