// Общий контракт между main, preload и renderer.
// Этот файл не импортирует ничего из Electron — только типы и константы,
// поэтому его безопасно подключать в любом процессе.

// `as const` превращает объект в «только для чтения» и сужает типы значений:
// без него тип IpcChannels.getAppInfo был бы просто `string`,
// а с ним — литерал 'app:get-info'. Так опечатку в имени канала поймает компилятор.
export const IpcChannels = {
  getAppInfo: 'app:get-info',
  getCs2Status: 'cs2:get-status',
  getRecentMatches: 'matches:get-recent'
} as const

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
}
