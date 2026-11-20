import { app, ipcMain, BrowserWindow, Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IpcChannels, type AppInfo } from '../shared/ipc'
import { createMainWindow, markQuitting, showWindow } from './window'
import { createTray } from './tray'
import { ensureAutostart, isAutostartEnabled, wasLaunchedHidden } from './autostart'

// Ссылки держим на уровне модуля: если Tray окажется только в локальной
// переменной функции, сборщик мусора его удалит и иконка исчезнет из трея.
// `BrowserWindow | null` — объединение типов: «окно или ещё ничего».
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ── Single-instance lock ──────────────────────────────────────────────
// Первый экземпляр получает «замок». Второй получает false и сразу выходит,
// а первому прилетает событие 'second-instance' — в ответ показываем окно.
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) showWindow(mainWindow)
  })

  app.whenReady().then(bootstrap)
}

function bootstrap(): void {
  // AppUserModelId нужен Windows для уведомлений и группировки в панели задач.
  // Должен совпадать с appId в electron-builder.yml.
  electronApp.setAppUserModelId('com.gamekeeper.app')

  // F12 — DevTools в dev; в собранной версии отключает Ctrl+R (перезагрузку).
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ensureAutostart()
  registerIpc()

  // При автозапуске с флагом --hidden окно создаём, но не показываем.
  mainWindow = createMainWindow({ showOnReady: !wasLaunchedHidden() })

  tray = createTray({
    onShow: () => {
      if (mainWindow) showWindow(mainWindow)
    },
    onQuit: () => app.quit()
  })
}

function registerIpc(): void {
  // ipcMain.handle отвечает на ipcRenderer.invoke из preload.
  // Возвращаемое значение автоматически становится Promise на той стороне.
  ipcMain.handle(IpcChannels.getAppInfo, (): AppInfo => {
    return {
      version: app.getVersion(),
      autostartEnabled: isAutostartEnabled(),
      isPackaged: app.isPackaged
    }
  })
}

// 'before-quit' срабатывает при app.quit() — разрешаем окну закрыться по-настоящему.
app.on('before-quit', () => {
  markQuitting()
  tray?.destroy() // `?.` — вызвать, только если tray не null
})

// По умолчанию Electron завершает приложение, когда закрыты все окна.
// Нам это не нужно: Gamekeeper живёт в трее. Пустой обработчик отменяет это поведение.
app.on('window-all-closed', () => {})
