// Общий контракт между main, preload и renderer.
// Этот файл не импортирует ничего из Electron — только типы и константы,
// поэтому его безопасно подключать в любом процессе.

// `as const` превращает объект в «только для чтения» и сужает типы значений:
// без него тип IpcChannels.getAppInfo был бы просто `string`,
// а с ним — литерал 'app:get-info'. Так опечатку в имени канала поймает компилятор.
export const IpcChannels = {
  getAppInfo: 'app:get-info'
} as const

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
}
