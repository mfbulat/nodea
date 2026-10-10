// Комментарии как в веб-версии: обсуждение привязано к теме и показано меткой в месте щелчка,
// по метке открывается окно обсуждения (листание ‹ ›, «решено», удаление, ответ);
// панель справа — список обсуждений с фильтром, пустое состояние и кнопка «Добавить комментарий».
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useEditor } from './store'
import { indexSheet, type Comment, type Sheet, type Topic } from './model'
import { canvasApi } from './MapCanvas'
import { Dropdown, MenuItem, Tip } from './Chrome'
import Icon from '../ui/Icon'
import { avatarColor } from '../ui/avatar'

interface Box { id: string; x: number; y: number; w: number; h: number }
type Pt = { x: number; y: number }

export const useCommentFilter = create<{ resolved: boolean; mine: boolean }>(() => ({ resolved: false, mine: false }))

export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="cm-ava" style={{ width: size, height: size, fontSize: size * 0.5, background: avatarColor(name) }}>{(name || '?').trim()[0]?.toUpperCase()}</span>
}
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' })
}
export const defaultPos = (b: Box): Pt => ({ x: b.w - 6, y: -10 })

/** обсуждения листа в порядке обхода (с учётом фильтра) */
export function threads(sheet: Sheet, user: string) {
  const f = useCommentFilter.getState()
  return [...indexSheet(sheet).values()].map(r => r.topic)
    .filter(t => t.comments?.length && (f.resolved || !t.commentsResolved) && (!f.mine || t.comments.some(c => c.author === user)))
}

/** ближайшая к точке тема: та, что под точкой, иначе — с ближайшим центром */
export function nearestTopic(boxes: Map<string, Box>, p: Pt) {
  let best: Box | undefined, bd = Infinity
  for (const b of boxes.values()) {
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b
    const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y)
    if (d < bd) { bd = d; best = b }
  }
  return best
}

function Composer({ onSend, autoFocus, placeholder = 'Write a comment', me }: { onSend: (t: string) => void; autoFocus?: boolean; placeholder?: string; me?: string }) {
  const [text, setText] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (ta.current) { ta.current.style.height = '0'; ta.current.style.height = ta.current.scrollHeight + 'px' } }, [text])
  const send = () => { if (text.trim()) { onSend(text.trim()); setText('') } }
  return (
    <div className={'cm-composer' + (text ? ' full' : '')}>
      {me !== undefined && <Avatar name={me} />}
      <textarea ref={ta} rows={1} autoFocus={autoFocus} placeholder={placeholder} value={text} aria-label="Comment text"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } if (e.key === 'Escape') useEditor.getState().setThread(null) }} />
      {text && <div className="cm-actions"><button className="cm-at" onClick={() => { setText(t => t + '@'); ta.current?.focus() }} aria-label="Mention">@</button>
        <div className="spacer" /><button className="cm-send" onClick={send} aria-label="Send" title="Send (⌘ Enter)">
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M7 12V2M3 6l4-4 4 4" /></svg></button></div>}
      {!text && <button className="cm-send off" disabled aria-label="Send">
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M7 12V2M3 6l4-4 4 4" /></svg></button>}
    </div>
  )
}

function CommentItem({ c, topicId, mine }: { c: Comment; topicId: string; mine: boolean }) {
  return (
    <div className="cm-item">
      <div className="cm-item-head"><Avatar name={c.author} /><b>{c.author || 'Anonymous'}</b><span className="cm-time">{ago(c.createdAt)}</span>
        {mine && <button className="cm-del" title="Delete Comment" aria-label="Delete Comment" onClick={() => useEditor.getState().removeComment(topicId, c.id)}><Icon name="close" size={12} /></button>}
      </div>
      <div className="cm-text">{c.text}</div>
    </div>
  )
}

/** Метки обсуждений и окно открытого обсуждения поверх холста. */
export function CommentLayer({ sheet, boxes, view, readOnly }: { sheet: Sheet; boxes: Map<string, Box>; view: { x: number; y: number; zoom: number }; readOnly: boolean }) {
  const { thread, userName, commenting } = useEditor()
  const filter = useCommentFilter()
  const ed = useEditor.getState()
  const list = threads(sheet, userName)
  void filter
  useEffect(() => {
    if (!thread && !commenting) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); ed.setThread(null); ed.setCommenting(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [thread, commenting])

  const pinAt = (t: Topic, pos?: Pt) => {
    const b = boxes.get(t.id)
    if (!b) return null
    const p = pos ?? t.commentPos ?? defaultPos(b)
    return { x: (b.x + p.x) * view.zoom + view.x, y: (b.y + p.y) * view.zoom + view.y }
  }
  const open = thread ? indexSheet(sheet).get(thread.id)?.topic : undefined
  const openAt = open ? pinAt(open, open.comments?.length ? undefined : thread!.pos) : null
  const i = open ? list.findIndex(t => t.id === open.id) : -1
  const go = (d: number) => { const t = list[(i + d + list.length) % list.length]; if (t) { canvasApi.center(t.id); ed.setThread({ id: t.id }) } }

  return (
    <>
      {list.map(t => {
        const p = pinAt(t)
        if (!p) return null
        return (
          <button key={t.id} className={'cm-pin' + (thread?.id === t.id ? ' on' : '') + (t.commentsResolved ? ' done' : '')} style={{ left: p.x, top: p.y }}
            aria-label={`Thread: ${t.title}`} data-testid="comment-pin"
            onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); ed.setThread(thread?.id === t.id ? null : { id: t.id }) }}>
            {t.comments!.length}
          </button>
        )
      })}
      {thread && !open?.comments?.length && openAt && <span className="cm-pin draft" style={{ left: openAt.x, top: openAt.y }} />}
      {open && openAt && (
        <div className="cm-pop" style={{ left: openAt.x + 26, top: Math.max(8, openAt.y - 14) }} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
          role="dialog" aria-label="Thread">
          {open.comments?.length ? (
            <>
              <div className="cm-pop-head">
                <button className="ibtn" disabled={list.length < 2} onClick={() => go(-1)} aria-label="Previous thread"><Icon name="chevronRight" size={14} /></button>
                <button className="ibtn" disabled={list.length < 2} onClick={() => go(1)} aria-label="Next thread"><Icon name="chevronRight" size={14} /></button>
                <div className="spacer" />
                {!readOnly && <Tip title={open.commentsResolved ? 'Reopen' : 'Resolve'}>
                  <button className={'ibtn' + (open.commentsResolved ? ' on' : '')} aria-label="Resolve" onClick={() => { ed.resolveThread(open.id, !open.commentsResolved); if (!open.commentsResolved && !useCommentFilter.getState().resolved) ed.setThread(null) }}>
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"><circle cx={8} cy={8} r={6} /><path d="M5.5 8.2l1.8 1.8 3.2-3.6" /></svg>
                  </button></Tip>}
                {!readOnly && <Dropdown align="right" trigger={(o, toggle) => <button className={'ibtn' + (o ? ' on' : '')} onClick={toggle} aria-label="More"><Icon name="more" size={16} /></button>}>
                  {close => <>
                    <MenuItem label="Go to Topic" onClick={() => { close(); ed.select([open.id]); canvasApi.center(open.id) }} />
                    <MenuItem label="Delete Thread" onClick={() => { close(); ed.removeThread(open.id) }} />
                  </>}
                </Dropdown>}
              </div>
              <div className="cm-pop-body">
                {open.comments.map(c => <CommentItem key={c.id} c={c} topicId={open.id} mine={!readOnly && c.author === userName} />)}
              </div>
              {!readOnly && <div className="cm-pop-foot"><Composer me={userName} onSend={t => ed.addComment(open.id, t)} /></div>}
            </>
          ) : (
            <div className="cm-pop-new"><Composer autoFocus onSend={t => { ed.addComment(open.id, t, thread!.pos); ed.setThread({ id: open.id }) }} /></div>
          )}
        </div>
      )}
    </>
  )
}

export function CommentsPanel({ sheet }: { sheet: Sheet }) {
  const { userName, thread } = useEditor()
  const filter = useCommentFilter()
  const ed = useEditor.getState()
  const list = threads(sheet, userName)
  const total = [...indexSheet(sheet).values()].filter(r => r.topic.comments?.length)
  const add = () => ed.setCommenting(true)
  return (
    <div className="side-panel cm-panel" data-testid="comments-panel">
      <div className="cm-panel-head">
        <b>Comments</b><div className="spacer" />
        <Tip title="Add Comment" desc="Click anywhere on the map."><button className="ibtn" onClick={add} aria-label="Add Comment">
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"><rect x={2} y={2.5} width={12} height={10} rx={2.5} /><path d="M8 5.2v4.6M5.7 7.5h4.6" /></svg></button></Tip>
        <Dropdown align="right" trigger={(o, toggle) => <Tip title="Filter"><button className={'ibtn' + (o || filter.resolved || filter.mine ? ' on' : '')} onClick={toggle} aria-label="Filter comments">
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round"><path d="M2.5 4h11M4.5 8h7M6.5 12h3" /></svg></button></Tip>}>
          {close => <>
            <MenuItem label="Show Resolved" checked={filter.resolved} onClick={() => { close(); useCommentFilter.setState({ resolved: !filter.resolved }) }} />
            <MenuItem label="Only Mine" checked={filter.mine} onClick={() => { close(); useCommentFilter.setState({ mine: !filter.mine }) }} />
          </>}
        </Dropdown>
        <Dropdown align="right" trigger={(o, toggle) => <button className={'ibtn' + (o ? ' on' : '')} onClick={toggle} aria-label="More"><Icon name="more" size={16} /></button>}>
          {close => <>
            <MenuItem label="Resolve All" disabled={!total.some(r => !r.topic.commentsResolved)} onClick={() => { close(); total.forEach(r => ed.resolveThread(r.topic.id, true)); ed.setThread(null) }} />
            <MenuItem label="Delete Resolved" disabled={!total.some(r => r.topic.commentsResolved)} onClick={() => { close(); total.filter(r => r.topic.commentsResolved).forEach(r => ed.removeThread(r.topic.id)) }} />
          </>}
        </Dropdown>
      </div>
      {list.length ? (
        <div className="cm-cards">
          {list.map(t => {
            const c = t.comments![0], more = t.comments!.length - 1
            return (
              <button key={t.id} className={'cm-card' + (thread?.id === t.id ? ' on' : '') + (t.commentsResolved ? ' done' : '')}
                onClick={() => { canvasApi.center(t.id); ed.setThread({ id: t.id }) }}>
                <div className="cm-item-head"><Avatar name={c.author} size={22} /><b>{c.author || 'Anonymous'}</b></div>
                <div className="cm-meta">{ago(c.createdAt)} · {t.title || sheet.title}</div>
                <div className="cm-text clamp">{c.text}</div>
                {more > 0 && <div className="cm-more">{more} {more === 1 ? 'reply' : 'replies'}</div>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="cm-empty">
          <svg width={44} height={36} viewBox="0 0 44 36" fill="none" strokeLinejoin="round">
            <rect x={1.5} y={1.5} width={26} height={19} rx={4} fill="#fff" stroke="#1f2326" strokeWidth={1.6} /><path d="M9 11l4 3.5 6-7" stroke="#ff6b6b" strokeWidth={2} strokeLinecap="round" />
            <rect x={15.5} y={12.5} width={27} height={19} rx={4} fill="#fff" stroke="#1f2326" strokeWidth={1.6} /><path d="M21 19.5h15M21 24.5h10" stroke="#4fc3e8" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <b>{total.length ? 'No matching comments' : 'No Comments'}</b>
          <span>Click anywhere on the map<br />to add a comment.</span>
          <button className="btn-dark" onClick={add}>Add Comment</button>
        </div>
      )}
    </div>
  )
}
