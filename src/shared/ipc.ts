import type { ActionResult } from './protection'

// Общий контракт между main, preload и renderer.
// Этот файл не импортирует ничего из Electron — только типы и константы,
// поэтому его безопасно подключать в любом процессе.

// `as const` превращает объект в «только для чтения» и сужает типы значений:
// без него тип IpcChannels.getAppInfo был бы просто `string`,
// а с ним — литерал 'app:get-info'. Так опечатку в имени канала поймает компилятор.
export const IpcChannels = {
  getAppInfo: 'app:get-info',
  getCs2Status: 'cs2:get-status',
  getRecentMatches: 'matches:get-recent',
  getTodayStatus: 'rules:get-today',
  getProtectionState: 'protection:get-state',
  setInitialPassword: 'protection:set-initial-password',
  changePassword: 'protection:change-password',
  setMatchLimit: 'settings:set-match-limit',
  setCloseDelay: 'settings:set-close-delay',
  requestUnlock: 'protection:request-unlock',
  requestQuit: 'protection:request-quit',
  cancelPending: 'protection:cancel'
} as const

/** Ожидающее ослабление в том виде, в каком его показывает интерфейс. */
export interface PendingChangeInfo {
  id: number
  kind: 'raise_limit' | 'raise_close_delay' | 'unlock' | 'quit'
  value: number | null
  applyAt: number
}

export interface ProtectionState {
  hasPassword: boolean
  matchLimit: number
  closeDelaySeconds: number
  pending: PendingChangeInfo[]
}

/** Состояние лимита на сегодня (даты — в мс, чтобы было проще передавать и форматировать). */
export interface TodayStatus {
  status: 'allowed' | 'grace' | 'blocked'
  matchesToday: number
  limit: number
  remaining: number
  closeAt: number | null
  nextResetAt: number
  unlockedUntil: number | null
}

/** Состояние интеграции с CS2 — показывается на главной странице. */
export interface Cs2Status {
  steamPath: string | null
  gamePath: string | null
  /** Что произошло с gamestate_integration_gamekeeper.cfg при запуске. */
  config: 'installed' | 'updated' | 'unchanged' | 'cs2-not-found' | 'error' | 'pending'
  server: 'listening' | 'error' | 'stopped'
  port: number
  /** Текст последней ошибки (установка cfg или запуск сервера). */
  error: string | null
  /** Время последнего сообщения от CS2, мс с 1970 г. null — сообщений ещё не было. */
  lastPayloadAt: number | null
  mapName: string | null
  mode: string | null
  phase: string | null
  inMatch: boolean
}

/** Засчитанная катка в том виде, в каком её получает интерфейс. */
export interface MatchRecord {
  id: number
  finishedAt: number
  mode: string
  map: string
  ctScore: number | null
  tScore: number | null
}

// `interface` описывает форму объекта. Здесь — то, что main вернёт в renderer.
export interface AppInfo {
  version: string
  autostartEnabled: boolean
  isPackaged: boolean
  databasePath: string
  matchLimit: number
}

// API, который preload кладёт в window.gamekeeper.
// Все методы асинхронные: IPC между процессами всегда идёт через Promise.
export interface GamekeeperApi {
  getAppInfo(): Promise<AppInfo>
  getCs2Status(): Promise<Cs2Status>
  getRecentMatches(limit?: number): Promise<MatchRecord[]>
  getTodayStatus(): Promise<TodayStatus>
  getProtectionState(): Promise<ProtectionState>
  setInitialPassword(password: string): Promise<ActionResult>
  changePassword(current: string, next: string): Promise<ActionResult>
  /** password нужен только для увеличения лимита. */
  setMatchLimit(value: number, password?: string): Promise<ActionResult>
  setCloseDelay(seconds: number, password?: string): Promise<ActionResult>
  requestUnlock(password: string): Promise<ActionResult>
  requestQuit(password: string): Promise<ActionResult>
  cancelPending(id: number): Promise<void>
}
