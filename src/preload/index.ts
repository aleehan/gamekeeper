import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type GamekeeperApi } from '../shared/ipc'

// Preload выполняется до загрузки страницы и имеет доступ к ipcRenderer.
// Мы НЕ отдаём странице ipcRenderer целиком (это дыра в безопасности),
// а только узкий набор функций.
//
// `satisfies GamekeeperApi` проверяет, что объект соответствует интерфейсу,
// но сохраняет его точный тип. Забудешь метод или ошибёшься в типе — будет ошибка компиляции.
const api = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  getCs2Status: () => ipcRenderer.invoke(IpcChannels.getCs2Status),
  getRecentMatches: (limit?: number) => ipcRenderer.invoke(IpcChannels.getRecentMatches, limit),
  getTodayStatus: () => ipcRenderer.invoke(IpcChannels.getTodayStatus)
} satisfies GamekeeperApi

contextBridge.exposeInMainWorld('gamekeeper', api)
