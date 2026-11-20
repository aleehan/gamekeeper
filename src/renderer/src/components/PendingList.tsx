import type { PendingChangeInfo } from '../../../shared/ipc'
import { useNow } from '../hooks/useNow'
import { formatCountdown } from '../lib/format'
import { describePending } from '../lib/labels'

// Props — тип входных параметров компонента. Деструктурируем их прямо в сигнатуре.
interface PendingListProps {
  items: PendingChangeInfo[]
  onCancel: (id: number) => void
}

/** Ожидающие ослабления с обратным отсчётом и кнопкой отмены. */
export function PendingList({ items, onCancel }: PendingListProps): React.JSX.Element | null {
  const now = useNow()
  // Компонент может ничего не рисовать — тогда возвращает null.
  if (items.length === 0) return null

  return (
    <section className="card">
      <h3>Ожидают применения</h3>
      <ul className="pending-list">
        {items.map((change) => (
          <li key={change.id}>
            <span>{describePending(change)}</span>
            <span className="muted">через {formatCountdown(change.applyAt - now)}</span>
            <button onClick={() => onCancel(change.id)}>Отменить</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
