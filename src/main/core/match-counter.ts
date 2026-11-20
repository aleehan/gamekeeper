import type { GsiPayload, MapPhase } from './games/cs2/gsi-payload'

/**
 * Режимы, которые засчитываются.
 * competitive — «Соревновательный» (Premier, судя по сообщениям сообщества, приходит так же),
 * premier — на случай, если Premier приходит отдельным именем,
 * scrimcomp2v2 — «Напарники».
 * ReadonlySet — Set, который нельзя изменить после создания.
 */
export const COUNTED_MODES: ReadonlySet<string> = new Set([
  'competitive',
  'premier',
  'scrimcomp2v2'
])

/** Фазы, во время которых идёт матч и игру нельзя закрывать. */
const IN_MATCH_PHASES: ReadonlySet<string> = new Set(['warmup', 'live', 'intermission'])

export interface FinishedMatch {
  finishedAt: Date
  mode: string
  map: string
  steamId: string
  ctScore: number | null
  tScore: number | null
}

/**
 * Автомат состояний поверх потока сообщений GSI.
 *
 * Катка засчитывается, когда одновременно:
 *  1. фаза карты переходит в 'gameover' из другой известной фазы (а не просто «пришёл gameover»:
 *     CS2 повторяет состояние в heartbeat, и одна катка не должна посчитаться дважды);
 *  2. режим соревновательный (COUNTED_MODES);
 *  3. за этот матч хотя бы раз пришло сообщение, где player — это сам владелец
 *     клиента (player.steamid === provider.steamid) и он в команде.
 *     Это отсекает просмотр демок/GOTV. Проверять только в момент gameover нельзя:
 *     мёртвый игрок наблюдает за тиммейтом, и player указывает на него.
 */
export class MatchCounter {
  private mapName: string | null = null
  private phase: MapPhase | null = null
  private selfPlayed = false

  /**
   * Обрабатывает очередное сообщение. Возвращает FinishedMatch, если катка
   * только что завершилась и её надо засчитать, иначе null.
   */
  update(payload: GsiPayload, now: Date = new Date()): FinishedMatch | null {
    const { map, player, provider } = payload // деструктуризация: достаём поля в переменные

    // Нет блока map — игрок в главном меню. Забываем текущий матч.
    if (!map) {
      this.reset()
      return null
    }

    // Сменилась карта — это новый матч; предыдущая фаза неизвестна.
    if (map.name !== this.mapName) {
      this.reset()
      this.mapName = map.name
    }

    const isSelf =
      player !== undefined &&
      provider !== undefined &&
      player.steamid === provider.steamid &&
      (player.team === 'CT' || player.team === 'T')
    if (isSelf) this.selfPlayed = true

    const previousPhase = this.phase
    this.phase = map.phase

    const justFinished =
      map.phase === 'gameover' && previousPhase !== null && previousPhase !== 'gameover'

    if (!justFinished || !COUNTED_MODES.has(map.mode) || !this.selfPlayed || !provider) {
      return null
    }

    return {
      finishedAt: now,
      mode: map.mode,
      map: map.name,
      steamId: provider.steamid,
      ctScore: map.ctScore,
      tScore: map.tScore
    }
  }

  /** Идёт ли сейчас матч (понадобится enforcer'у: посреди матча игру не закрываем). */
  isInMatch(): boolean {
    return this.phase !== null && IN_MATCH_PHASES.has(this.phase)
  }

  get currentPhase(): MapPhase | null {
    // `get` — геттер: снаружи читается как поле (counter.currentPhase), без скобок.
    return this.phase
  }

  private reset(): void {
    this.mapName = null
    this.phase = null
    this.selfPlayed = false
  }
}
