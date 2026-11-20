// Все тексты, которые зависят от значений из main: статусы, ошибки, режимы.
// Record<Тип, string> заставляет компилятор проверить, что подпись есть для КАЖДОГО значения.

import type { Cs2Status, PendingChangeInfo, TodayStatus } from '../../../shared/ipc'
import type { ActionResult, ProtectionError } from '../../../shared/protection'

export const TODAY_STATUS_TEXT: Record<TodayStatus['status'], string> = {
  allowed: 'Можно играть',
  grace: 'Лимит исчерпан — CS2 скоро закроется',
  blocked: 'Лимит исчерпан — CS2 заблокирована'
}

export const ERROR_TEXT: Record<ProtectionError, string> = {
  'password-not-set': 'Сначала задай пароль.',
  'password-already-set': 'Пароль уже задан.',
  'wrong-password': 'Неверный пароль.',
  'password-too-short': 'Пароль слишком короткий — минимум 4 символа.',
  'invalid-value': 'Недопустимое значение.',
  unchanged: 'Значение не изменилось.'
}

export function resultText(result: ActionResult): string {
  if (!result.ok) return ERROR_TEXT[result.error]
  return result.applied === 'now'
    ? 'Сохранено.'
    : 'Запрос принят. Изменение вступит в силу через 10 минут, до этого его можно отменить.'
}

export function describePending(change: PendingChangeInfo): string {
  // switch по всем вариантам kind: если добавить новый вид и забыть его здесь,
  // TS сообщит, что функция может ничего не вернуть.
  switch (change.kind) {
    case 'raise_limit':
      return `Лимит каток → ${change.value}`
    case 'raise_close_delay':
      return `Задержка закрытия → ${change.value} с`
    case 'unlock':
      return 'Снятие блокировки до 05:00'
    case 'quit':
      return 'Выход из Gamekeeper'
  }
}

const MODE_TEXT: Record<string, string> = {
  competitive: 'Соревновательный',
  premier: 'Premier',
  scrimcomp2v2: 'Напарники',
  casual: 'Обычный',
  deathmatch: 'Бой насмерть'
}

/** Название режима; неизвестные режимы показываем как есть. */
export function modeText(mode: string): string {
  return MODE_TEXT[mode] ?? mode
}

/** Одна строка о связи с CS2 для главной страницы. */
export function cs2ConnectionText(cs2: Cs2Status): string {
  if (cs2.config === 'cs2-not-found') return 'CS2 не найдена на этом компьютере'
  if (cs2.server === 'error') return `Ошибка GSI-сервера: ${cs2.error ?? 'неизвестно'}`
  if (cs2.config === 'error') return `Не удалось установить конфиг: ${cs2.error ?? 'неизвестно'}`
  if (cs2.lastPayloadAt === null) return 'Ждём CS2 — запусти игру'
  if (!cs2.mapName) return 'CS2 подключена, в меню'
  return `CS2 подключена · ${cs2.mapName} · ${cs2.mode ? modeText(cs2.mode) : ''}${
    cs2.inMatch ? ' · идёт матч' : ''
  }`
}

export const CONFIG_TEXT: Record<Cs2Status['config'], string> = {
  pending: 'проверяется…',
  installed: 'установлен — перезапусти CS2, если она открыта',
  updated: 'обновлён — перезапусти CS2, если она открыта',
  unchanged: 'на месте',
  'cs2-not-found': 'CS2 не найдена',
  error: 'ошибка'
}

export const SERVER_TEXT: Record<Cs2Status['server'], string> = {
  listening: 'работает',
  error: 'ошибка',
  stopped: 'остановлен'
}
