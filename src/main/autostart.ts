import { app } from 'electron'

// Флаг командной строки, с которым Windows запускает нас при входе в систему.
// Увидев его, приложение стартует сразу в трей, без окна.
export const HIDDEN_FLAG = '--hidden'

/**
 * Включает автозапуск с Windows (запись в HKCU\...\Run).
 *
 * В режиме разработки (`npm run dev`) ничего не делаем: там исполняемый файл —
 * это голый electron.exe из node_modules, и прописывать его в автозагрузку нельзя.
 */
export function ensureAutostart(): void {
  if (!app.isPackaged) return

  app.setLoginItemSettings({
    openAtLogin: true,
    args: [HIDDEN_FLAG]
  })
}

export function isAutostartEnabled(): boolean {
  // На Windows getLoginItemSettings нужно передать те же args, что и при установке,
  // иначе Electron не узнает «свою» запись в реестре.
  return app.getLoginItemSettings({ args: [HIDDEN_FLAG] }).openAtLogin
}

// `process.argv` — массив строк аргументов запуска. `includes` вернёт boolean.
export function wasLaunchedHidden(argv: string[] = process.argv): boolean {
  return argv.includes(HIDDEN_FLAG)
}
