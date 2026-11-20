import { useState } from 'react'
import { MATCH_LIMIT_MAX, MATCH_LIMIT_MIN } from '../../../shared/protection'
import { Feedback } from '../components/Feedback'
import { PendingList } from '../components/PendingList'
import { useAction } from '../hooks/useAction'
import type { AppData } from '../hooks/useAppData'
import { CONFIG_TEXT, SERVER_TEXT } from '../lib/labels'

interface SettingsPageProps {
  data: AppData
  reload: () => Promise<void>
}

const LIMIT_OPTIONS = Array.from(
  { length: MATCH_LIMIT_MAX - MATCH_LIMIT_MIN + 1 },
  (_, i) => MATCH_LIMIT_MIN + i
)
const DELAY_OPTIONS = [0, 30, 60, 120, 300]

function delayText(seconds: number): string {
  if (seconds === 0) return 'сразу'
  return seconds < 60 ? `через ${seconds} с` : `через ${seconds / 60} мин`
}

export function SettingsPage({ data, reload }: SettingsPageProps): React.JSX.Element {
  const { protection, info, cs2 } = data

  return (
    <main className="page">
      {/* key: когда значение в базе меняется, React пересоздаёт секцию,
          и её внутреннее состояние (выбранное значение) берётся заново из current. */}
      <LimitSection key={protection.matchLimit} current={protection.matchLimit} reload={reload} />
      <DelaySection
        key={protection.closeDelaySeconds}
        current={protection.closeDelaySeconds}
        reload={reload}
      />
      <PendingList
        items={protection.pending}
        onCancel={(id) => void window.gamekeeper.cancelPending(id).then(reload)}
      />
      <PasswordSection />
      <QuitSection reload={reload} />

      <section className="card">
        <h3>Диагностика</h3>
        <dl className="info">
          <dt>CS2</dt>
          <dd>{cs2.gamePath ?? 'не найдена'}</dd>
          <dt>GSI-конфиг</dt>
          <dd>{CONFIG_TEXT[cs2.config]}</dd>
          <dt>GSI-сервер</dt>
          <dd>
            {SERVER_TEXT[cs2.server]}, порт {cs2.port}
          </dd>
          {cs2.error && (
            <>
              <dt>Ошибка</dt>
              <dd className="error">{cs2.error}</dd>
            </>
          )}
          <dt>Автозапуск</dt>
          <dd>{info.autostartEnabled ? 'включён' : 'выключен (только в собранной версии)'}</dd>
          <dt>База данных</dt>
          <dd className="small">{info.databasePath}</dd>
          <dt>Версия</dt>
          <dd>{info.version}</dd>
        </dl>
      </section>
    </main>
  )
}

// Ниже — секции страницы. Они не экспортируются: используются только здесь.

function LimitSection({
  current,
  reload
}: {
  current: number
  reload: () => Promise<void>
}): React.JSX.Element {
  const [value, setValue] = useState(current)
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()
  const loosening = value > current

  async function save(): Promise<void> {
    const result = await run(() =>
      window.gamekeeper.setMatchLimit(value, loosening ? password : undefined)
    )
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <section className="card form">
      <h3>Лимит каток в день</h3>
      <div className="row">
        <select value={value} onChange={(e) => setValue(Number(e.target.value))}>
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="muted">сейчас: {current}</span>
      </div>
      {loosening && (
        <input
          type="password"
          placeholder="Пароль — для увеличения лимита"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      <div className="row">
        <button
          disabled={busy || value === current || (loosening && !password)}
          onClick={() => void save()}
        >
          {loosening ? 'Запросить увеличение' : 'Сохранить'}
        </button>
        {loosening && <span className="muted small">вступит в силу через 10 минут</span>}
      </div>
      <Feedback value={feedback} />
    </section>
  )
}

function DelaySection({
  current,
  reload
}: {
  current: number
  reload: () => Promise<void>
}): React.JSX.Element {
  const [value, setValue] = useState(current)
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()
  const loosening = value > current
  // Текущее значение может не входить в список (например, задано раньше) — добавляем его.
  const options = DELAY_OPTIONS.includes(current)
    ? DELAY_OPTIONS
    : [...DELAY_OPTIONS, current].sort((a, b) => a - b)

  async function save(): Promise<void> {
    const result = await run(() =>
      window.gamekeeper.setCloseDelay(value, loosening ? password : undefined)
    )
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <section className="card form">
      <h3>Когда закрывать CS2 после последней катки</h3>
      <div className="row">
        <select value={value} onChange={(e) => setValue(Number(e.target.value))}>
          {options.map((s) => (
            <option key={s} value={s}>
              {delayText(s)}
            </option>
          ))}
        </select>
        <span className="muted">сейчас: {delayText(current)}</span>
      </div>
      <p className="muted small">Если за это время начнётся новый матч, игра закроется сразу.</p>
      {loosening && (
        <input
          type="password"
          placeholder="Пароль — для увеличения задержки"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      <div className="row">
        <button
          disabled={busy || value === current || (loosening && !password)}
          onClick={() => void save()}
        >
          {loosening ? 'Запросить изменение' : 'Сохранить'}
        </button>
      </div>
      <Feedback value={feedback} />
    </section>
  )
}

function PasswordSection(): React.JSX.Element {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const { feedback, busy, run } = useAction()

  async function save(): Promise<void> {
    if (next !== confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    const result = await run(() => window.gamekeeper.changePassword(current, next))
    if (result.ok) {
      setCurrent('')
      setNext('')
      setConfirm('')
    }
  }

  return (
    <section className="card form">
      <h3>Сменить пароль</h3>
      <input
        type="password"
        placeholder="Текущий пароль"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <input
        type="password"
        placeholder="Новый пароль"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <input
        type="password"
        placeholder="Новый пароль ещё раз"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <div className="row">
        <button disabled={busy || !current || !next} onClick={() => void save()}>
          Сменить
        </button>
      </div>
      {mismatch && <p className="feedback error">Новые пароли не совпадают.</p>}
      <Feedback value={feedback} />
    </section>
  )
}

function QuitSection({ reload }: { reload: () => Promise<void> }): React.JSX.Element {
  const [password, setPassword] = useState('')
  const { feedback, busy, run } = useAction()

  async function quit(): Promise<void> {
    const result = await run(() => window.gamekeeper.requestQuit(password))
    if (result.ok) setPassword('')
    await reload()
  }

  return (
    <section className="card form">
      <h3>Выйти из Gamekeeper</h3>
      <p className="muted small">
        Приложение закроется через 10 минут после подтверждения. Пока оно не запущено, ограничения
        не действуют; при следующем входе в Windows оно запустится снова.
      </p>
      <div className="row">
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={busy || !password} onClick={() => void quit()}>
          Запросить выход
        </button>
      </div>
      <Feedback value={feedback} />
    </section>
  )
}
