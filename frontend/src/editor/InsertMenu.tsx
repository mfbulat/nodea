// Меню «Вставить» (как в веб-версии): сводка, зона | заметка, метка, выноска, комментарий,
// to-do, задача, ссылка ▸ | вложение, аудиозаметка | стикер, иллюстрация, изображение, формула.
import { useEditor } from './store'
import Icon, { IconName } from '../ui/Icon'
import { pickFile, uploadToTopic } from './actions'
import { indexSheet } from './model'
import { Dropdown, MenuItem, SubMenu, Tip } from './Chrome'
import { recordAudio } from './audio'

export default function InsertMenu() {
  const { selection } = useEditor()
  const ed = useEditor.getState()
  const id = selection[selection.length - 1]
  const none = !id
  const sheet = ed.sheet()
  const ref = id && sheet ? indexSheet(sheet).get(id) : undefined
  const isChild = ref?.kind === 'child'
  const item = (icon: IconName, label: string, fn: () => void, disabled = none, hint?: string) =>
    (close: () => void) => <MenuItem key={label} icon={icon} label={label} hint={hint} disabled={disabled} onClick={() => { close(); fn() }} />

  return (
    <Dropdown align="left" trigger={(open, toggle) => (
      <Tip title="Вставить" desc="Добавить другие элементы к выбранным темам.">
        <button onClick={toggle} className={'ibtn insert-btn' + (open ? ' on' : '')} aria-label="Вставить">
          <Icon name="plus" /><Icon name="chevron" size={12} /></button>
      </Tip>
    )}>
      {close => <>
        {item('summary', 'Сводка', ed.addSummary, none || !isChild)(close)}
        {item('boundary', 'Зона', ed.addBoundary, none, '⌘ ⇧ B')(close)}
        <div className="menu-sep" />
        {item('note', 'Заметка', () => ed.setPanel('notes'), none, '⌘ ⇧ N')(close)}
        {item('label', 'Метка', () => ed.setDialog({ kind: 'labels', id }), none, '⌘ ⇧ L')(close)}
        {item('callout', 'Выноска', ed.addCallout, none || ref?.kind === 'root')(close)}
        {item('comment', 'Комментарий', () => ed.setPanel('comments'))(close)}
        {item('task', 'To-Do', () => ed.setTopic(selection, { task: ref?.topic.task ? undefined : { done: false } }), none, '⌥ ⌘ T')(close)}
        {item('gantt', 'Задача', () => { ed.setTaskDialog(id) })(close)}
        <SubMenu icon="link" label="Ссылка">
          <MenuItem icon="link" label="Веб-ссылка" disabled={none} onClick={() => { close(); ed.setDialog({ kind: 'link', id }) }} />
          <MenuItem icon="topic" label="Ссылка на тему" disabled={none} onClick={() => { close(); ed.setDialog({ kind: 'link', id }) }} />
        </SubMenu>
        <div className="menu-sep" />
        {item('attach', 'Вложение', async () => { const f = await pickFile(); if (f) uploadToTopic(id, f, 'attachment') })(close)}
        {item('mic', 'Аудиозаметка', () => recordAudio(id))(close)}
        <div className="menu-sep" />
        {item('sticker', 'Стикер', () => { ed.setPanel('markers'); ed.setMarkerTab('stickers') })(close)}
        {item('illustration', 'Иллюстрация', () => { ed.setPanel('markers'); ed.setMarkerTab('illustrations') })(close)}
        {item('image', 'Изображение', async () => { const f = await pickFile('image/*'); if (f) uploadToTopic(id, f, 'image') }, none, '⌘ ⇧ I')(close)}
        {item('equation', 'Формула', () => ed.setDialog({ kind: 'equation', id }))(close)}
      </>}
    </Dropdown>
  )
}
