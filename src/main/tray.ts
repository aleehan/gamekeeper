import { Menu, Tray, nativeImage } from 'electron'
import icon from '../../resources/icon.png?asset'

// Описываем, что трею нужно от внешнего мира, через интерфейс колбэков.
// Так tray.ts не знает про окно напрямую — его можно переиспользовать и тестировать.
export interface TrayActions {
  onShow: () => void
  onQuit: () => void
}

export function createTray(actions: TrayActions): Tray {
  // Иконка трея на Windows — 16x16; большую картинку уменьшаем.
  const image = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  const tray = new Tray(image)

  tray.setToolTip('Gamekeeper')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть Gamekeeper', click: actions.onShow },
      { type: 'separator' },
      // Выход — только по паролю через 10 минут; пункт открывает окно с запросом.
      { label: 'Выход…', click: actions.onQuit }
    ])
  )

  // Одиночный клик по иконке открывает окно (привычное поведение на Windows).
  tray.on('click', actions.onShow)

  return tray
}
