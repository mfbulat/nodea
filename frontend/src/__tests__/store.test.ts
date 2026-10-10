import { beforeEach, describe, expect, it } from 'vitest'
import { useDoc } from '../store/doc'
import { useEditor } from '../editor/store'
import type { MapDocument, Topic } from '../editor/model'

const titles = (t: Topic): string => t.title + (t.children?.length ? '[' + t.children.map(titles).join(',') + ']' : '')
const root = () => useDoc.getState().doc!.sheets[0].rootTopic as Topic
const ed = () => useEditor.getState()

beforeEach(() => {
  const document: MapDocument = { version: 1, sheets: [{ id: 's', title: 'L', rootTopic: { id: 'r', title: 'R', children: [
    { id: 'a', title: 'A', children: [{ id: 'a1', title: 'A1' }] }, { id: 'b', title: 'B', children: [] }] } }] }
  // без сети: автосохранение не должно падать тест
  useDoc.setState({ mapId: null, doc: document, title: 'T', revision: 1 })
  ed().reset()
})

describe('операции редактора', () => {
  it('подтема, соседняя, удаление, отмена/повтор', () => {
    ed().select(['b']); ed().addChild(); ed().stopEdit()
    ed().select(['a']); ed().addSibling(false); ed().stopEdit()
    expect(titles(root())).toBe('R[A[A1],Main Topic 3,B[Subtopic 1]]')
    ed().select(['a']); ed().removeSelected()
    expect(titles(root())).toBe('R[Main Topic 3,B[Subtopic 1]]')
    ed().undo()
    expect(titles(root())).toBe('R[A[A1],Main Topic 3,B[Subtopic 1]]')
    ed().redo()
    expect(titles(root())).toBe('R[Main Topic 3,B[Subtopic 1]]')
  })

  it('перемещение: в дочерние, перед соседом, запрет на перенос в потомка', () => {
    ed().move(['a1'], 'b', 'child')
    expect(titles(root())).toBe('R[A,B[A1]]')
    ed().move(['b'], 'a', 'before')
    expect(titles(root())).toBe('R[B[A1],A]')
    ed().move(['b'], 'a1', 'child')
    expect(titles(root())).toBe('R[B[A1],A]')
  })

  it('копировать / вставить с новыми id, вырезать', () => {
    ed().select(['a']); ed().copy()
    ed().select(['b']); ed().paste()
    const pasted = root().children![1].children![0]
    expect(pasted.title).toBe('A')
    expect(pasted.id).not.toBe('a')
    ed().select(['a']); ed().cut()
    expect(titles(root())).toBe('R[B[A[A1]]]')
  })

  it('сводка удаляется вместе с последней темой диапазона', () => {
    ed().select(['a1']); ed().addSummary(); ed().stopEdit()
    expect(root().children![0].summaries).toHaveLength(1)
    ed().select(['a1']); ed().removeSelected()
    expect(root().children![0].summaries).toBeUndefined()
  })

  it('маркеры одной группы взаимоисключающие', () => {
    ed().select(['a'])
    ed().toggleMarker('priority-1'); ed().toggleMarker('priority-2'); ed().toggleMarker('flag-red')
    expect(root().children![0].markers).toEqual(['priority-2', 'flag-red'])
    ed().toggleMarker('flag-red')
    expect(root().children![0].markers).toEqual(['priority-2'])
  })

  it('связь, поиск и замена', () => {
    ed().select(['a']); ed().startRelating(); ed().finishRelating('b')
    expect(useDoc.getState().doc!.sheets[0].relationships).toHaveLength(1)
    ed().setSearch({ open: true, query: 'a' })
    expect(ed().search.hits.sort()).toEqual(['a', 'a1'])
    expect(ed().replaceAll('A', 'Z')).toBe(2)
    expect(titles(root())).toBe('R[Z[Z1],B]')
  })

  it('дублировать, удалить только тему, новый лист из темы, сброс положения', () => {
    ed().select(['a']); ed().duplicate()
    expect(titles(root())).toBe('R[A[A1],A[A1],B]')
    ed().undo()
    ed().select(['a']); ed().deleteSingle()
    expect(titles(root())).toBe('R[A1,B]')
    ed().undo()
    ed().newSheetFromTopic('a')
    const sheets = useDoc.getState().doc!.sheets
    expect(sheets.map(s => titles(s.rootTopic as Topic))).toEqual(['R[A[A1],B]', 'A[A1]'])
    expect(sheets[1].rootTopic.id).not.toBe('a')
    ed().setSheetId('s')
    ed().select(['b']); ed().setTopic(['b'], { offset: { x: 10, y: 5 } })
    ed().resetPosition()
    expect((root().children![1] as Topic).offset).toBeUndefined()
  })
})
