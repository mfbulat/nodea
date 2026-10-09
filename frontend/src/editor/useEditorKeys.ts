import { useEffect } from 'react'
import { canvasApi, isTyping } from './MapCanvas'
import { currentLayout, useEditor } from './store'
import { topicsFromText, topicsToText, type Topic } from './model'
import { resolveStyle } from './themes'
import { indexSheet } from './model'
import { pickFile, uploadToTopic } from './actions'

const MIME = 'application/x-mindmap-topics'

// Латинская и русская раскладки; e.code бывает пустым у синтетических событий
const KEYS: Record<string, string[]> = {
  KeyA: ['a', 'ф'], KeyL: ['l', 'д'], KeyB: ['b', 'и'], KeyK: ['k', 'л'], KeyN: ['n', 'т'], BracketRight: [']', 'ъ'],
  KeyR: ['r', 'к'], KeyI: ['i', 'ш'], KeyT: ['t', 'е'], KeyD: ['d', 'в'], KeyG: ['g', 'п'], KeyF: ['f', 'а'], KeyP: ['p', 'з'], Semicolon: [';', 'ж'], KeyO: ['o', 'щ'], KeyH: ['h', 'р'], KeyC: ['c', 'с'], KeyX: ['x', 'ч'], KeyV: ['v', 'м'], KeyZ: ['z', 'я'], KeyY: ['y', 'н'],
  Slash: ['/', '.'], Equal: ['=', '+'], Minus: ['-', '_'], Digit0: ['0', ')'],
}
const is = (e: KeyboardEvent, code: string) =>
  e.code ? e.code === code : (KEYS[code] ?? []).includes(e.key.toLowerCase())

/** Выбор ближайшей темы в направлении стрелки */
function neighbor(id: string, dir: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): string | null {
  const layout = currentLayout()
  const from = layout?.boxes.get(id)
  if (!layout || !from) return null
  const cx = from.x + from.w / 2, cy = from.y + from.h / 2
  let best: { id: string; score: number } | null = null
  for (const b of layout.boxes.values()) {
    if (b.id === id) continue
    const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy
    const [main, cross] = dir === 'ArrowLeft' ? [-dx, dy] : dir === 'ArrowRight' ? [dx, dy] : dir === 'ArrowUp' ? [-dy, dx] : [dy, dx]
    // тема должна лежать в направлении (с допуском на перекрытие)
    const overlap = dir === 'ArrowLeft' || dir === 'ArrowRight'
      ? (dir === 'ArrowLeft' ? b.x + b.w <= from.x + 2 : b.x >= from.x + from.w - 2)
      : (dir === 'ArrowUp' ? b.y + b.h <= from.y + 2 : b.y >= from.y + from.h - 2)
    if (main <= 0 || !overlap) continue
    const score = main + Math.abs(cross) * 2.5
    if (!best || score < best.score) best = { id: b.id, score }
  }
  return best?.id ?? null
}

export function useEditorKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const ed = useEditor.getState
    let clipboardEventSeen = false

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || ed().editingId) return
      const mod = e.metaKey || e.ctrlKey
      const sel = ed().selection
      const primary = sel[sel.length - 1]
      const k = e.key
      const handled = () => { e.preventDefault(); e.stopPropagation() }

      if (mod && is(e, 'KeyZ')) { handled(); e.shiftKey ? ed().redo() : ed().undo(); return }
      if (mod && is(e, 'KeyY')) { handled(); ed().redo(); return }
      // сочетания как в XMind (⌘ на macOS, Ctrl в других системах)
      if (mod && e.altKey && is(e, 'Slash')) { handled(); ed().foldAll(); return }
      if (mod && is(e, 'Slash')) { handled(); ed().toggleCollapse(); return }
      if (mod && is(e, 'KeyA')) { handled(); ed().selectAll(); return }
      if (mod && e.shiftKey && is(e, 'KeyR')) { handled(); ed().startRelating(); return }
      if (mod && !e.shiftKey && is(e, 'KeyR')) { handled(); ed().goCentral(); return }
      if (mod && e.shiftKey && is(e, 'KeyB')) { handled(); ed().addBoundary(); return }
      if (mod && e.shiftKey && is(e, 'KeyL') && primary) { handled(); ed().setDialog({ kind: 'labels', id: primary }); return }
      if (mod && e.shiftKey && is(e, 'KeyN') && primary) { handled(); ed().setPanel('notes'); return }
      if (mod && e.shiftKey && is(e, 'KeyI') && primary) { handled(); pickFile('image/*').then(f => f && uploadToTopic(primary, f, 'image')); return }
      if (mod && e.altKey && is(e, 'KeyT') && primary) { handled(); const t = ed().sheet() && indexSheet(ed().sheet()!).get(primary)?.topic; ed().setTopic(sel, { task: t?.task ? undefined : { done: false } }); return }
      if (mod && e.altKey && is(e, 'KeyN')) { handled(); ed().addSheet(); return }
      if (mod && !e.shiftKey && is(e, 'KeyD')) { handled(); ed().duplicate(); return }
      if (mod && (k === 'Backspace' || k === 'Delete')) { handled(); ed().deleteSingle(); return }
      if (mod && k === 'Enter') { handled(); ed().addParent(); return }
      if (mod && is(e, 'BracketRight')) { handled(); ed().setPanel(ed().panel === 'format' ? null : 'format'); return }
      if (mod && is(e, 'KeyK') && primary) { handled(); ed().setDialog({ kind: 'link', id: primary }); return }
      if (mod && e.altKey && is(e, 'Digit0')) { handled(); ed().clearStyle(); return }
      // Буфер обмена: копирование — сразу во внутренний буфер (системный заполняется
      // в событии copy/cut); вставка ждёт событие paste, иначе берёт внутренний буфер
      if (mod && !e.altKey && (is(e, 'KeyC') || is(e, 'KeyX'))) {
        if (is(e, 'KeyC')) ed().copy(); else ed().cut()
        return
      }
      if (mod && !e.altKey && is(e, 'KeyV')) {
        clipboardEventSeen = false
        const target = primary
        setTimeout(() => { if (!clipboardEventSeen) ed().paste(undefined, target) }, 60)
        return
      }
      if (mod && e.altKey && is(e, 'KeyC')) { handled(); copyStyle(); return }
      if (mod && e.altKey && is(e, 'KeyV')) { handled(); ed().pasteStyle(); return }
      if (mod && (is(e, 'Equal') || e.code === 'NumpadAdd')) { handled(); canvasApi.zoomBy(1.2); return }
      if (mod && (is(e, 'Minus') || e.code === 'NumpadSubtract')) { handled(); canvasApi.zoomBy(1 / 1.2); return }
      if (mod && is(e, 'Digit0')) { handled(); e.shiftKey ? canvasApi.fit() : canvasApi.zoomTo(1); return }
      if (mod) return

      if (k === 'Escape') { if (!ed().relating) ed().select([]); return }
      if (ed().element) {
        if (k === 'Delete' || k === 'Backspace') { handled(); ed().removeElement() }
        return
      }
      if (!primary) {
        if (k === 'Enter' || k.startsWith('Arrow') || k === 'Tab') { handled(); const sh = ed().sheet(); if (sh) ed().select([sh.rootTopic.id]) }
        return
      }
      if (k === 'Tab') { handled(); ed().addChild(); return }
      if (k === 'Enter') { handled(); ed().addSibling(e.shiftKey); return }
      if (k === 'Delete' || k === 'Backspace') { handled(); ed().removeSelected(); return }
      if (k === 'F2' || k === ' ') { handled(); ed().startEdit(primary); return }
      if (k === 'Home') { handled(); const sh = ed().sheet(); if (sh) ed().select([sh.rootTopic.id]); return }
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
        handled()
        const n = neighbor(primary, k)
        if (n) {
          ed().select(e.shiftKey ? [...sel.filter(s => s !== n), n] : [n])
          canvasApi.ensureVisible(n)
        }
        return
      }
      // печатный символ — начать правку с заменой текста
      if (k.length === 1 && !e.altKey) { handled(); ed().startEdit(primary, k) }
    }

    const copyStyle = () => {
      const sheet = ed().sheet()
      const id = ed().selection[ed().selection.length - 1]
      if (!sheet || !id) return
      const ref = indexSheet(sheet).get(id)
      if (ref) ed().copyStyle(resolveStyle(sheet, ref))
    }

    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e) || ed().editingId || !ed().clipboard) return
      e.preventDefault()
      const topics = ed().clipboard ?? []
      e.clipboardData?.setData(MIME, JSON.stringify(topics))
      e.clipboardData?.setData('text/plain', topicsToText(topics))
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e) || ed().editingId) return
      clipboardEventSeen = true
      e.preventDefault()
      const raw = e.clipboardData?.getData(MIME)
      if (raw) { try { ed().paste(JSON.parse(raw) as Topic[]); return } catch { /* ignore */ } }
      const text = e.clipboardData?.getData('text/plain')
      if (text?.trim()) ed().paste(topicsFromText(text))
      else ed().paste()
    }

    window.addEventListener('keydown', onKey)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCopy)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCopy)
      document.removeEventListener('paste', onPaste)
    }
  }, [enabled])
}
