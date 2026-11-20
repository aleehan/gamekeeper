import { randomBytes } from 'crypto'
import type { Cs2Status } from '../../../../shared/ipc'
import { getSettings, insertMatch, updateSettings, type Db, type Match } from '../../db'
import { GsiServer } from '../../gsi-server'
import { MatchCounter } from '../../match-counter'
import { installGsiConfig } from './gsi-config'
import type { GsiPayload } from './gsi-payload'
import { findCs2Install, findSteamPath } from './steam-locator'

/** Порт GSI-сервера. Выбран из редко используемого диапазона. */
export const DEFAULT_GSI_PORT = 47815

export interface Cs2IntegrationOptions {
  db: Db
  port?: number
  /** Вызывается после записи засчитанной катки в базу. */
  onMatchRecorded?: (match: Match) => void
  log?: (message: string) => void
}

/**
 * Связывает всё вместе: токен из базы → поиск CS2 → установка cfg →
 * GSI-сервер → MatchCounter → запись катки в базу.
 */
export class Cs2Integration {
  private readonly counter = new MatchCounter()
  private server: GsiServer | null = null
  private readonly log: (message: string) => void
  private status: Cs2Status

  constructor(private readonly options: Cs2IntegrationOptions) {
    // `??` подставляет функцию-пустышку, если log не передан, — дальше не нужно проверять на undefined.
    this.log = options.log ?? (() => {})
    this.status = {
      steamPath: null,
      gamePath: null,
      config: 'pending',
      server: 'stopped',
      port: options.port ?? DEFAULT_GSI_PORT,
      error: null,
      lastPayloadAt: null,
      mapName: null,
      mode: null,
      phase: null,
      inMatch: false
    }
  }

  async start(): Promise<void> {
    const token = this.ensureToken()

    // 1. Конфиг. Если CS2 не найдена, сервер всё равно запускаем:
    //    пользователь может установить игру позже, а cfg положить вручную.
    try {
      const steamPath = await findSteamPath()
      const install = steamPath ? await findCs2Install(steamPath) : null
      this.status.steamPath = steamPath
      this.status.gamePath = install?.gamePath ?? null

      if (install) {
        this.status.config = await installGsiConfig(install.cfgPath, {
          port: this.status.port,
          token
        })
        this.log(`GSI cfg: ${this.status.config} → ${install.cfgPath}`)
      } else {
        this.status.config = 'cs2-not-found'
        this.log('CS2 не найдена')
      }
    } catch (error) {
      this.status.config = 'error'
      this.status.error = errorMessage(error)
      this.log(`Ошибка установки GSI cfg: ${this.status.error}`)
    }

    // 2. Сервер.
    this.server = new GsiServer({
      port: this.status.port,
      token,
      onPayload: (payload) => this.handlePayload(payload),
      onError: (error) => this.log(`GSI: ${error.message}`)
    })
    try {
      await this.server.start()
      this.status.server = 'listening'
      this.log(`GSI-сервер слушает 127.0.0.1:${this.status.port}`)
    } catch (error) {
      this.status.server = 'error'
      this.status.error = errorMessage(error)
      this.log(`GSI-сервер не запустился: ${this.status.error}`)
    }
  }

  async stop(): Promise<void> {
    await this.server?.stop()
    this.status.server = 'stopped'
  }

  /** Копия статуса: снаружи не должны менять наш внутренний объект. */
  getStatus(): Cs2Status {
    // Spread `{ ...obj }` создаёт поверхностную копию объекта.
    return { ...this.status }
  }

  isInMatch(): boolean {
    return this.counter.isInMatch()
  }

  private handlePayload(payload: GsiPayload): void {
    // Сообщения от других игр (если кто-то подсунет наш токен) игнорируем.
    if (payload.provider && payload.provider.appid !== 730) return

    const finished = this.counter.update(payload)

    this.status.lastPayloadAt = Date.now()
    this.status.mapName = payload.map?.name ?? null
    this.status.mode = payload.map?.mode ?? null
    this.status.phase = payload.map?.phase ?? null
    this.status.inMatch = this.counter.isInMatch()

    if (finished) {
      const match = insertMatch(this.options.db, finished)
      this.log(`Катка засчитана: ${match.map} (${match.mode}) ${match.ctScore}:${match.tScore}`)
      this.options.onMatchRecorded?.(match)
    }
  }

  /** Берёт токен из настроек; при первом запуске генерирует и сохраняет. */
  private ensureToken(): string {
    const existing = getSettings(this.options.db).gsiToken
    if (existing) return existing
    // 16 случайных байт → 32 hex-символа. Криптостойкий генератор, а не Math.random.
    const token = randomBytes(16).toString('hex')
    updateSettings(this.options.db, { gsiToken: token })
    return token
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
