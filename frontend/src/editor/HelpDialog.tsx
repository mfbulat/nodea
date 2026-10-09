// Справка по сочетаниям клавиш
export const SHORTCUTS: [string, string][] = [
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

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose() }}>
      <div className="modal help" role="dialog" aria-label="Сочетания клавиш">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Сочетания клавиш</h3><div className="spacer" />
          <button className="ibtn" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <table><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}
