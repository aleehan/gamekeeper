# Gamekeeper

Десктопное приложение для Windows 11, которое блокирует CS2 после N сыгранных за день каток.

Пользователь изучает TypeScript: при работе объясняй, что делаешь и почему, особенно TS-конструкции (типы, дженерики, модули, async/await).

## Стек

- Electron + React + TypeScript (шаблон electron-vite)
- Drizzle ORM + SQLite (better-sqlite3)
- electron-builder (сборка установщика)

## Архитектура

```
src/
  main/                 — main-процесс Electron
    core/               — бизнес-логика БЕЗ импорта 'electron' (тестируется отдельно)
      gsi-server.ts     — HTTP-сервер, принимающий POST от CS2 Game State Integration
      match-counter.ts  — подсчёт завершённых каток
      rules-engine.ts   — лимит, состояние блокировки, сброс в 05:00
      enforcer.ts       — поиск и закрытие cs2.exe
      db/               — схема Drizzle, миграции, репозитории
      games/cs2/        — путь к Steam/CS2, установка gsi cfg, разбор payload
    index.ts            — точка входа: окно, трей, автозапуск, IPC, single-instance
  preload/              — мост window.gamekeeper через contextBridge
  renderer/             — React UI: Главная, Настройки, История
```

Правило: `src/main/core/*` не импортирует `electron`. Всё, что связано с Electron (окно, трей, уведомления, app.getPath), живёт в `src/main/` и передаётся в core через параметры/интерфейсы.

## Логика

- **GSI**: при запуске проверить/установить `gamestate_integration_gamekeeper.cfg` в `<CS2>/game/csgo/cfg/` с уникальным токеном. Путь Steam — из реестра (`HKCU\Software\Valve\Steam\SteamPath`), библиотеки — из `steamapps/libraryfolders.vdf` (CS2 appid 730).
- **Засчитывание катки**: переход `map.phase` → `gameover`; только соревновательные режимы (competitive, premier, wingman); `player.steamid` должен совпадать с `provider.steamid` (собственный SteamID, а не наблюдение). Дедупликация: одна катка — одна запись.
- **Лимит**: пользователь выбирает 1–10 каток в день.
- **Достижение лимита**: после последней катки — уведомление, через настраиваемое время (по умолчанию 2 мин) cs2.exe закрывается.
- **Блокировка**: пока активна, cs2.exe закрывается при каждом запуске.
- **Посреди матча не убивать**: если идёт live-матч, закрытие откладывается до его окончания.
- **Сброс счётчика**: ежедневно в 05:00 по локальному времени.

## Защита (средний уровень)

- Автозапуск с Windows.
- Закрытие окна сворачивает в трей, а не завершает приложение.
- Single-instance lock: второй экземпляр не запускается, а показывает окно первого.
- Выход из приложения, снятие блокировки, ослабление лимита (увеличение N, увеличение задержки, отключение автозапуска) — только по паролю + задержка 10 минут перед применением.
- Ужесточение (уменьшить N и т.п.) — применяется сразу, без пароля.

## Этапы

1. ✅ Каркас electron-vite + React + TS, трей, сворачивание в трей, автозапуск, single-instance lock.
2. ✅ БД: Drizzle + better-sqlite3, схема (settings, matches, pending_changes), миграции.
3. ✅ CS2: поиск Steam/CS2, установка GSI cfg, GSI-сервер, match-counter.
4. Rules-engine + enforcer: лимит, блокировка, отложенное закрытие, сброс в 05:00.
5. Защита: пароль (хеш), отложенные ослабляющие изменения с задержкой 10 мин.
6. UI: Главная, Настройки, История; IPC через window.gamekeeper.
7. Сборка установщика electron-builder.

## Команды

- `npm run dev` — запуск в режиме разработки
- `npm run typecheck` — проверка типов
- `npm test` — юнит-тесты (Vitest). Тесты лежат рядом с кодом: `*.test.ts`. Тестировать можно только модули без better-sqlite3 и electron.
- `npm run build:win` — сборка установщика
- `npm run db:generate` — сгенерировать SQL-миграцию после изменения `src/main/core/db/schema.ts`

## База данных

- Файл: `%APPDATA%\gamekeeper\gamekeeper.db`. Миграции применяются автоматически при старте (`openDatabase`).
- Миграции лежат в `drizzle/` и коммитятся; в сборку попадают через `extraResources`. Уже закоммиченные миграции не редактировать — только генерировать новые.
- `better-sqlite3` — нативный модуль, собран под Electron (`electron-builder install-app-deps` в postinstall). Обычный Node его не загрузит; для скриптов использовать `ELECTRON_RUN_AS_NODE=1 electron script.js`.

## CS2 / GSI

- GSI-сервер: `127.0.0.1:47815` (`DEFAULT_GSI_PORT` в `core/games/cs2/integration.ts`). Токен генерируется один раз и хранится в `settings.gsi_token`.
- Конфиг `gamestate_integration_gamekeeper.cfg` ставится при каждом старте приложения, если содержимое отличается. CS2 читает cfg только при своём запуске — после установки игру нужно перезапустить.
- Засчитывание катки — `MatchCounter` (`core/match-counter.ts`): переход фазы в `gameover` из известной фазы + соревновательный режим + за матч хотя бы раз `player.steamid === provider.steamid` с командой CT/T. Проверять SteamID только в момент gameover нельзя: мёртвый игрок наблюдает за тиммейтом.
- Ручная проверка без игры: POST JSON на сервер с токеном из базы (см. формат в `gsi-payload.ts`).
