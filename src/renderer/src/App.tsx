import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/ipc'

function App(): React.JSX.Element {
  // useState<AppInfo | null> — дженерик: явно говорим React, какой тип хранится.
  // Сначала null (данных ещё нет), потом придёт объект AppInfo.
  const [info, setInfo] = useState<AppInfo | null>(null)

  // useEffect с пустым массивом зависимостей выполняется один раз после первого рендера.
  useEffect(() => {
    window.gamekeeper.getAppInfo().then(setInfo)
  }, [])

  return (
    <main className="app">
      <h1>Gamekeeper</h1>
      <p className="subtitle">Этап 1: каркас приложения</p>

      {/* Пока info === null, показываем заглушку. */}
      {info === null ? (
        <p>Загрузка…</p>
      ) : (
        <dl className="info">
          <dt>Версия</dt>
          <dd>{info.version}</dd>
          <dt>Автозапуск</dt>
          <dd>
            {info.autostartEnabled
              ? 'включён'
              : info.isPackaged
                ? 'выключен'
                : 'выключен (в режиме разработки не регистрируется)'}
          </dd>
        </dl>
      )}

      <p className="hint">Закрытие окна сворачивает приложение в трей.</p>
    </main>
  )
}

export default App
