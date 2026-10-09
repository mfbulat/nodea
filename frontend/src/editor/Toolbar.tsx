import { useState } from 'react'
import { useEditor } from './store'
import { canvasApi } from './MapCanvas'
import InsertMenu from './InsertMenu'

const SHORTCUTS: [string, string][] = [
  ['Tab', 'Подтема'], ['Enter', 'Соседняя тема ниже'], ['Shift+Enter', 'Соседняя тема выше'],
  ['Delete / Backspace', 'Удалить'], ['F2 / Пробел / ввод символа', 'Правка текста'],
  ['Стрелки', 'Навигация (Shift — добавить к выделению)'], ['Ctrl+/', 'Свернуть / развернуть'],
  ['Ctrl+Z / Ctrl+Shift+Z, Ctrl+Y', 'Отмена / повтор'], ['Ctrl+C / X / V', 'Копировать / вырезать / вставить'],
  ['Ctrl+Alt+C / V', 'Копировать / вставить стиль'], ['Ctrl+A', 'Выделить всё'],
  ['Ctrl+= / Ctrl+-', 'Масштаб'], ['Ctrl+0 / Ctrl+Shift+0', 'Вписать в экран / 100%'],
  ['Ctrl/Shift+щелчок, рамка мышью', 'Мультивыделение'], ['Пробел+перетаскивание, правая кнопка, колесо', 'Прокрутка'],
  ['Ctrl+колесо', 'Масштаб'], ['Ctrl+L / Ctrl+B / Ctrl+]', 'Связь / граница / сводка'], ['Ctrl+K', 'Ссылка'],
  ['Ctrl+Shift+N', 'Заметка'], ['Перетащить файл на тему', 'Изображение или вложение'],
  ['Двойной щелчок по связи/границе', 'Подпись'], ['Двойной щелчок по пустому месту', 'Плавающая тема'], ['Home', 'К центральной теме'],
]

export default function Toolbar() {
  const { past, future, view, selection, panel } = useEditor()
  const ed = useEditor.getState()
  const [help, setHelp] = useState(false)
  const none = !selection.length
  return (
    <div className="toolbar">
      <button onClick={ed.undo} disabled={!past.length} title="Отменить (Ctrl+Z)">↶</button>
      <button onClick={ed.redo} disabled={!future.length} title="Повторить (Ctrl+Shift+Z)">↷</button>
      <span className="sep" />
      <button onClick={() => ed.addSibling(false)} disabled={none} title="Тема (Enter)">Тема</button>
      <button onClick={ed.addChild} disabled={none} title="Подтема (Tab)">Подтема</button>
      <button onClick={() => {
        const sh = ed.sheet(); const v = ed.view
        if (sh) ed.addFloating((200 - v.x) / v.zoom, (120 - v.y) / v.zoom)
      }} title="Плавающая тема (двойной щелчок по холсту)">Плавающая</button>
      <button onClick={ed.toggleCollapse} disabled={none} title="Свернуть / развернуть (Ctrl+/)">Свернуть</button>
      <button onClick={ed.removeSelected} disabled={none} title="Удалить (Delete)">Удалить</button>
      <InsertMenu />
      <button onClick={ed.startRelating} disabled={none} title="Связь (Ctrl+L)">Связь</button>
      <button onClick={ed.addBoundary} disabled={none} title="Граница (Ctrl+B)">Граница</button>
      <button onClick={ed.addSummary} disabled={none} title="Сводка (Ctrl+])">Сводка</button>
      <span className="sep" />
      <button onClick={() => canvasApi.zoomBy(1 / 1.2)} title="Уменьшить (Ctrl+-)">−</button>
      <button className="zoom-label" onClick={() => canvasApi.zoomTo(1)} title="100%">{Math.round(view.zoom * 100)}%</button>
      <button onClick={() => canvasApi.zoomBy(1.2)} title="Увеличить (Ctrl+=)">+</button>
      <button onClick={() => canvasApi.fit()} title="Вписать в экран (Ctrl+0)">Вписать</button>
      <div className="spacer" />
      <button onClick={() => setHelp(h => !h)}>Клавиши</button>
      <button className={panel === 'markers' ? 'on' : ''} onClick={() => ed.setPanel(panel === 'markers' ? null : 'markers')}>Маркеры</button>
      <button className={panel === 'notes' ? 'on' : ''} onClick={() => ed.setPanel(panel === 'notes' ? null : 'notes')}>Заметка</button>
      <button className={panel === 'comments' ? 'on' : ''} onClick={() => ed.setPanel(panel === 'comments' ? null : 'comments')}>Комментарии</button>
      <button className={panel === 'format' ? 'on' : ''} onClick={() => ed.setPanel(panel === 'format' ? null : 'format')}>Формат</button>
      {help && (
        <div className="help-pop" onClick={() => setHelp(false)}>
          <table><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  )
}
