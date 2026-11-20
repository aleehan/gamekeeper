import { useEffect, useState } from 'react'
import type { AppInfo, Cs2Status, MatchRecord } from '../../shared/ipc'

// Record<K, V> — объект, где ключи типа K, а значения типа V.
// Здесь TS проверит, что для КАЖДОГО варианта config есть подпись: забудешь один — ошибка.
const CONFIG_LABELS: Record<Cs2Status['config'], string> = {
  pending: 'проверяется…',
  installed: 'установлен (перезапусти CS2, если она открыта)',
  updated: 'обновлён (перезапусти CS2, если она открыта)',
  unchanged: 'на месте',
  'cs2-not-found': 'CS2 не найдена',
  error: 'ошибка'
}

const SERVER_LABELS: Record<Cs2Status['server'], string> = {
  listening: 'слушает',
  error: 'ошибка',
  stopped: 'остановлен'
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('ru-RU')
}

function App(): React.JSX.Element {
  // useState<AppInfo | null> — дженерик: явно говорим React, какой тип хранится.
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [cs2, setCs2] = useState<Cs2Status | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])

  useEffect(() => {
    window.gamekeeper.getAppInfo().then(setInfo)

    // async-функция внутри эффекта: сам колбэк useEffect не может быть async,
    // поэтому объявляем отдельную функцию и вызываем её.
    const refresh = async (): Promise<void> => {
      // Promise.all запускает оба запроса параллельно и ждёт оба.
      const [status, recent] = await Promise.all([
        window.gamekeeper.getCs2Status(),
        window.gamekeeper.getRecentMatches(5)
      ])
      setCs2(status)
      setMatches(recent)
    }

    void refresh()
    const timer = setInterval(refresh, 2000)
    // Функция, возвращённая из эффекта, — «уборка»: вызывается при размонтировании.
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="app">
      <h1>Gamekeeper</h1>
      <p className="subtitle">Этап 3: интеграция с CS2</p>

      {info && (
        <dl className="info">
          <dt>Версия</dt>
          <dd>{info.version}</dd>
          <dt>Лимит каток</dt>
          <dd>{info.matchLimit}</dd>
        </dl>
      )}

      <h2>CS2</h2>
      {cs2 === null ? (
        <p>Загрузка…</p>
      ) : (
        <dl className="info">
          <dt>Игра</dt>
          <dd>{cs2.gamePath ?? 'не найдена'}</dd>
          <dt>GSI-конфиг</dt>
          <dd>{CONFIG_LABELS[cs2.config]}</dd>
          <dt>GSI-сервер</dt>
          <dd>
            {SERVER_LABELS[cs2.server]} (порт {cs2.port})
          </dd>
          {cs2.error && (
            <>
              <dt>Ошибка</dt>
              <dd className="error">{cs2.error}</dd>
            </>
          )}
          <dt>Последнее сообщение</dt>
          <dd>{cs2.lastPayloadAt ? formatTime(cs2.lastPayloadAt) : 'ещё не было'}</dd>
          <dt>Сейчас</dt>
          <dd>
            {cs2.mapName
              ? `${cs2.mapName} · ${cs2.mode} · ${cs2.phase}${cs2.inMatch ? ' (идёт матч)' : ''}`
              : 'в меню / игра не запущена'}
          </dd>
        </dl>
      )}

      <h2>Последние катки</h2>
      {matches.length === 0 ? (
        <p className="hint">Пока ни одной.</p>
      ) : (
        <ul className="matches">
          {/* key помогает React понять, какой элемент списка какой, при обновлении. */}
          {matches.map((m) => (
            <li key={m.id}>
              {formatTime(m.finishedAt)} — {m.map} ({m.mode}) {m.ctScore ?? '?'}:{m.tScore ?? '?'}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default App
