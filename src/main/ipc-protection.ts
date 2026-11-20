import { ipcMain } from 'electron'
import { IpcChannels, type ProtectionState } from '../shared/ipc'
import type { ActionResult } from '../shared/protection'
import { getSettings, type Db } from './core/db'
import type { ProtectionService } from './core/protection'

// Всё, что приходит из renderer, — `unknown`: проверяем тип, прежде чем передать в core.
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number'
const optionalString = (v: unknown): string | undefined => (isString(v) ? v : undefined)

const INVALID: ActionResult = { ok: false, error: 'invalid-value' }

export function registerProtectionIpc(
  db: Db,
  protection: ProtectionService,
  /** Вызывается после любого изменения, которое может повлиять на блокировку. */
  onChanged: () => void
): void {
  ipcMain.handle(IpcChannels.getProtectionState, (): ProtectionState => {
    const settings = getSettings(db)
    return {
      hasPassword: settings.passwordHash !== null,
      matchLimit: settings.matchLimit,
      closeDelaySeconds: settings.closeDelaySeconds,
      pending: protection.listPending().map((c) => ({
        id: c.id,
        kind: c.kind,
        value: c.value,
        applyAt: c.applyAfter.getTime()
      }))
    }
  })

  ipcMain.handle(IpcChannels.setInitialPassword, (_e, password: unknown) =>
    isString(password) ? protection.setInitialPassword(password) : INVALID
  )

  ipcMain.handle(IpcChannels.changePassword, (_e, current: unknown, next: unknown) =>
    isString(current) && isString(next) ? protection.changePassword(current, next) : INVALID
  )

  ipcMain.handle(IpcChannels.setMatchLimit, async (_e, value: unknown, password: unknown) => {
    if (!isNumber(value)) return INVALID
    const result = await protection.setMatchLimit(value, optionalString(password))
    onChanged()
    return result
  })

  ipcMain.handle(IpcChannels.setCloseDelay, async (_e, seconds: unknown, password: unknown) => {
    if (!isNumber(seconds)) return INVALID
    const result = await protection.setCloseDelay(seconds, optionalString(password))
    onChanged()
    return result
  })

  ipcMain.handle(IpcChannels.requestUnlock, (_e, password: unknown) =>
    protection.requestUnlock(optionalString(password))
  )

  ipcMain.handle(IpcChannels.requestQuit, (_e, password: unknown) =>
    protection.requestQuit(optionalString(password))
  )

  ipcMain.handle(IpcChannels.cancelPending, (_e, id: unknown) => {
    if (isNumber(id)) protection.cancel(id)
  })
}
