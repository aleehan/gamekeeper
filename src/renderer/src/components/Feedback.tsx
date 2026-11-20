import type { ActionFeedback } from '../hooks/useAction'

/** Строка с результатом действия: зелёная при успехе, красная при ошибке. */
export function Feedback({ value }: { value: ActionFeedback | null }): React.JSX.Element | null {
  if (!value) return null
  return <p className={value.ok ? 'feedback ok' : 'feedback error'}>{value.text}</p>
}
