import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import { getSettings, openDatabase, type DatabaseHandle } from './db'
import { ProtectionService } from './protection'

// База в памяти (':memory:') с настоящими миграциями — быстро и без следов на диске.
let handle: DatabaseHandle
let clock: Date
let service: ProtectionService
const MINUTE = 60_000

beforeEach(async () => {
  handle = openDatabase({ filePath: ':memory:', migrationsFolder: join(process.cwd(), 'drizzle') })
  clock = new Date(2026, 10, 20, 18, 0)
  // Часы подменены: `now` возвращает переменную clock, которую тесты двигают вперёд.
  service = new ProtectionService({ db: handle.db, now: () => clock })
  await service.setInitialPassword('secret')
})

afterEach(() => handle.close())

const advance = (ms: number): void => {
  clock = new Date(clock.getTime() + ms)
}
const settings = (): ReturnType<typeof getSettings> => getSettings(handle.db)

describe('ProtectionService', () => {
  it('пароль: хранится только хеш, повторная установка запрещена', async () => {
    expect(settings().passwordHash).toMatch(/^scrypt\$/)
    expect(settings().passwordHash).not.toContain('secret')
    expect(await service.setInitialPassword('other')).toEqual({
      ok: false,
      error: 'password-already-set'
    })
  })

  it('уменьшение лимита — сразу и без пароля', async () => {
    expect(await service.setMatchLimit(1)).toEqual({ ok: true, applied: 'now' })
    expect(settings().matchLimit).toBe(1)
  })

  it('увеличение лимита — без пароля отказ, с неверным отказ', async () => {
    expect(await service.setMatchLimit(5)).toEqual({ ok: false, error: 'wrong-password' })
    expect(await service.setMatchLimit(5, 'nope')).toEqual({ ok: false, error: 'wrong-password' })
    expect(settings().matchLimit).toBe(3)
  })

  it('увеличение лимита применяется только через 10 минут', async () => {
    const result = await service.setMatchLimit(5, 'secret')
    expect(result).toMatchObject({ ok: true, applied: 'pending' })
    expect(settings().matchLimit).toBe(3)

    advance(9 * MINUTE)
    expect(service.applyDue()).toHaveLength(0)
    expect(settings().matchLimit).toBe(3)

    advance(1 * MINUTE)
    expect(service.applyDue().map((c) => c.kind)).toEqual(['raise_limit'])
    expect(settings().matchLimit).toBe(5)
    expect(service.listPending()).toHaveLength(0)
  })

  it('отмена ожидающего изменения — без пароля', async () => {
    await service.setMatchLimit(5, 'secret')
    const [pending] = service.listPending()
    service.cancel(pending.id)
    advance(11 * MINUTE)
    expect(service.applyDue()).toHaveLength(0)
    expect(settings().matchLimit).toBe(3)
  })

  it('ужесточение лимита отменяет ожидающее повышение', async () => {
    await service.setMatchLimit(5, 'secret')
    await service.setMatchLimit(2)
    advance(11 * MINUTE)
    service.applyDue()
    expect(settings().matchLimit).toBe(2)
  })

  it('повторный запрос заменяет предыдущий и перезапускает отсчёт', async () => {
    await service.setMatchLimit(5, 'secret')
    advance(8 * MINUTE)
    await service.setMatchLimit(6, 'secret')
    advance(3 * MINUTE)
    expect(service.applyDue()).toHaveLength(0)
    advance(7 * MINUTE)
    service.applyDue()
    expect(settings().matchLimit).toBe(6)
  })

  it('снятие блокировки действует до ближайших 05:00', async () => {
    await service.requestUnlock('secret')
    advance(10 * MINUTE)
    service.applyDue()
    expect(settings().unlockedUntil).toEqual(new Date(2026, 10, 21, 5, 0))
  })

  it('выход: применяется через 10 минут, при старте старые запросы отменяются', async () => {
    await service.requestQuit('secret')
    service.discardStaleQuitRequests()
    advance(11 * MINUTE)
    expect(service.applyDue()).toHaveLength(0)

    await service.requestQuit('secret')
    advance(10 * MINUTE)
    expect(service.applyDue().map((c) => c.kind)).toEqual(['quit'])
  })

  it('задержка закрытия: больше — по паролю, меньше — сразу', async () => {
    expect(await service.setCloseDelay(120)).toEqual({ ok: false, error: 'wrong-password' })
    expect(await service.setCloseDelay(120, 'secret')).toMatchObject({ applied: 'pending' })
    advance(10 * MINUTE)
    service.applyDue()
    expect(settings().closeDelaySeconds).toBe(120)
    expect(await service.setCloseDelay(30)).toEqual({ ok: true, applied: 'now' })
  })

  it('недопустимые значения отклоняются', async () => {
    expect(await service.setMatchLimit(0)).toEqual({ ok: false, error: 'invalid-value' })
    expect(await service.setMatchLimit(11, 'secret')).toEqual({ ok: false, error: 'invalid-value' })
    expect(await service.setMatchLimit(2.5)).toEqual({ ok: false, error: 'invalid-value' })
    expect(await service.setMatchLimit(3)).toEqual({ ok: false, error: 'unchanged' })
  })

  it('смена пароля требует текущий пароль', async () => {
    expect(await service.changePassword('wrong', 'newpass')).toEqual({
      ok: false,
      error: 'wrong-password'
    })
    expect(await service.changePassword('secret', 'newpass')).toEqual({ ok: true, applied: 'now' })
    expect(await service.requestUnlock('secret')).toEqual({ ok: false, error: 'wrong-password' })
    expect(await service.requestUnlock('newpass')).toMatchObject({ ok: true })
  })
})

describe('ProtectionService без пароля', () => {
  it('ослабление невозможно, пока пароль не задан', async () => {
    const fresh = openDatabase({
      filePath: ':memory:',
      migrationsFolder: join(process.cwd(), 'drizzle')
    })
    const noPassword = new ProtectionService({ db: fresh.db })
    expect(await noPassword.requestQuit('x')).toEqual({ ok: false, error: 'password-not-set' })
    expect(await noPassword.setInitialPassword('abc')).toEqual({
      ok: false,
      error: 'password-too-short'
    })
    fresh.close()
  })
})
