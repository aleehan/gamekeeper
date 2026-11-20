import { useState } from 'react'
import { useAppData } from './hooks/useAppData'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'

// Объединение строк вместо enum: проще и так же безопасно.
type Page = 'home' | 'settings' | 'history'

const NAV: { page: Page; label: string }[] = [
  { page: 'home', label: 'Главная' },
  { page: 'history', label: 'История' },
  { page: 'settings', label: 'Настройки' }
]

function App(): React.JSX.Element {
  const { data, reload } = useAppData()
  const [page, setPage] = useState<Page>('home')

  if (data === null) {
    return <main className="page muted">Загрузка…</main>
  }

  // Пока пароль не задан — только экран первой настройки.
  if (!data.protection.hasPassword) {
    return <OnboardingPage onDone={() => void reload()} />
  }

  return (
    <div className="layout">
      <nav className="nav">
        <span className="brand">Gamekeeper</span>
        {NAV.map((item) => (
          <button
            key={item.page}
            className={item.page === page ? 'nav-item active' : 'nav-item'}
            onClick={() => setPage(item.page)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {page === 'home' && <HomePage data={data} reload={reload} />}
      {page === 'history' && <HistoryPage data={data} />}
      {page === 'settings' && <SettingsPage data={data} reload={reload} />}
    </div>
  )
}

export default App
