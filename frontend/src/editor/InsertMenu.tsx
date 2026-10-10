// Меню «Вставить» (как в веб-версии): сводка, зона | заметка, метка, выноска, комментарий,
// to-do, задача, ссылка ▸ | вложение | стикер, иллюстрация, изображение, формула.
import { useEditor } from './store'
import Icon, { IconName } from '../ui/Icon'
import { pickFile, uploadToTopic } from './actions'
import { indexSheet } from './model'
import { Dropdown, MenuItem, SubMenu, Tip } from './Chrome'
import { insertTask } from './Gantt'

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
      <Tip title="Insert" desc="Add other elements to selected topics.">
        <button onClick={toggle} className={'ibtn insert-btn' + (open ? ' on' : '')} aria-label="Insert">
          <Icon name="plus" /><Icon name="chevron" size={12} /></button>
      </Tip>
    )}>
      {close => <>
        {item('summary', 'Summary', ed.addSummary, none || !isChild)(close)}
        {item('zone', 'Zone', ed.createZone, false, '⌘ ⌥ Z')(close)}
        <div className="menu-sep" />
        {item('note', 'Note', () => ed.setPanel('notes'), none, '⌘ ⇧ N')(close)}
        {item('label', 'Label', () => ed.setDialog({ kind: 'labels', id }), none, '⌘ ⇧ L')(close)}
        {item('callout', 'Callout', ed.addCallout, none || ref?.kind === 'callout')(close)}
        {item('comment', 'Comment', () => { ed.setPanel('comments'); ed.setThread({ id }) })(close)}
        {item('task', 'To-Do', () => ed.setTopic(selection, { task: ref?.topic.task ? undefined : { done: false } }), none, '⌥ ⌘ T')(close)}
        {item('gantt', 'Task', () => insertTask(id))(close)}
        <SubMenu icon="link" label="Link">
          <MenuItem icon="link" label="Web Link" disabled={none} onClick={() => { close(); ed.setDialog({ kind: 'link', id }) }} />
          <MenuItem icon="topic" label="Topic Link" disabled={none} onClick={() => { close(); ed.setDialog({ kind: 'link', id, mode: 'topic' }) }} />
        </SubMenu>
        <div className="menu-sep" />
        {item('attach', 'Attachment', async () => { const f = await pickFile(); if (f) uploadToTopic(id, f, 'attachment') })(close)}
        <div className="menu-sep" />
        {item('sticker', 'Sticker', () => { ed.setPanel('markers'); ed.setMarkerTab('stickers') })(close)}
        {item('illustration', 'Illustration', () => { ed.setPanel('markers'); ed.setMarkerTab('illustrations') })(close)}
        {item('image', 'Local Image', async () => { const f = await pickFile('image/*'); if (f) uploadToTopic(id, f, 'image') }, none, '⌘ ⇧ I')(close)}
        {item('equation', 'Equation', () => ed.setDialog({ kind: 'equation', id }))(close)}
      </>}
    </Dropdown>
  )
}
