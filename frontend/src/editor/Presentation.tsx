// Презентация (как Pitch в веб-версии): карта превращается в слайды на чёрном (или белом) фоне.
// Порядок: титульный слайд центральной темы → обзор (тема слева, скобка, подтемы появляются
// по шагам) → по слайду на каждую подтему с «хлебными крошками» и так далее вглубь.
// Настройки темы во вкладке «Презентация» (слайд / подтемы как слайды / показ / раскладка)
// управляют построением; сверху справа — зрители, настройки, полный экран, выход.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Sheet, Topic } from './model'
import { displaySheet } from './MapCanvas'
import { useEditor } from './store'
import { useCollab } from '../collab/session'
import Icon from '../ui/Icon'

type Layout = NonNullable<NonNullable<Topic['pitch']>['layout']>
interface TitleSlide { kind: 'title'; topic: Topic; crumbs: string[] }
interface OverviewSlide { kind: 'overview'; topic: Topic; items: Topic[]; crumbs: string[]; layout: Layout; reveal: boolean; root: boolean }
export type Slide = TitleSlide | OverviewSlide

export function buildSlides(root: Topic): Slide[] {
  const out: Slide[] = []
  const walk = (t: Topic, crumbs: string[], isRoot: boolean) => {
    const p = t.pitch ?? {}
    if (p.slide !== 'no') out.push({ kind: 'title', topic: t, crumbs })
    const kids = t.children ?? []
    if (!kids.length || p.subSlides === 'no') return
    const delivery = p.delivery ?? 'drill'
    out.push({ kind: 'overview', topic: t, items: kids, crumbs, layout: p.layout ?? 'list', reveal: delivery !== 'all', root: isRoot })
    if (delivery === 'drill') {
      kids.forEach(k => walk(k, isRoot ? [] : [...crumbs, t.title], false))
    }
  }
  walk(root, [], true)
  return out
}
export const stepsOf = (s: Slide) => (s.kind === 'overview' && s.reveal ? s.items.length : 0)

const RATIOS: Record<string, number> = { '16:9': 16 / 9, '4:3': 4 / 3, '9:16': 9 / 16, '3:4': 3 / 4 }

/** Подбор кегля: не больше base, текст влезает в maxW×maxH (переносы по словам). */
function fitSize(text: string, base: number, maxW: number, maxH: number, k = 0.6, min = 12) {
  const words = (text || ' ').split(/\s+/)
  for (let fs = base; fs > min; fs *= 0.92) {
    const cw = fs * k
    let lines = 1, line = 0, ok = true
    for (const w of words) {
      const len = w.length * cw
      if (len > maxW) { ok = false; break }
      if (line && line + cw + len > maxW) { lines++; line = len } else line += (line ? cw : 0) + len
    }
    if (ok && lines * fs * 1.15 <= maxH) return fs
  }
  return min
}

function Crumbs({ crumbs, H }: { crumbs: string[]; H: number }) {
  if (!crumbs.length) return null
  return <div className="pitch-crumbs" style={{ fontSize: Math.max(12, H * 0.027) }}>{crumbs.join('  ›  ')}<i /></div>
}

export function SlideView({ slide, step, W, H, anim }: { slide: Slide; step: number; W: number; H: number; anim: boolean }) {
  if (slide.kind === 'title') {
    const fs = fitSize(slide.topic.title, H * 0.155, W * 0.84, H * 0.7, 0.62)
    return (
      <div className={'pitch-slide' + (anim ? ' anim' : '')}>
        <Crumbs crumbs={slide.crumbs} H={H} />
        <div className="pitch-title" style={{ fontSize: fs }}>{slide.topic.title}</div>
      </div>
    )
  }
  const { topic, items, layout } = slide
  const shown = slide.reveal ? items.slice(0, step) : items
  const n = items.length
  const vertical = W < H
  const itemFs = Math.min(H * 0.072, (H * 0.76) / (n * 1.55), ...items.map(i => fitSize(i.title, H * 0.072, layout === 'columns' ? W * 0.84 / Math.min(n, 4) - 16 : W * (vertical ? 0.8 : 0.42), H * 0.3, 0.55)))
  const headFs = fitSize(topic.title, H * (layout === 'list' || layout === 'branch' ? 0.1 : 0.08), layout === 'list' || layout === 'branch' ? W * 0.34 : W * 0.84, H * 0.5, 0.68)
  const itemsEl = (cls: string) => shown.map((it, i) => <div key={it.id} className={cls + (anim ? ' anim' : '')} style={{ fontSize: itemFs, animationDelay: anim && !slide.reveal ? `${i * 60}ms` : undefined }}>{it.title}</div>)

  if (layout === 'list' || layout === 'branch') {
    const top = H * 0.12, bottom = H * 0.88, span = bottom - top
    const ys = items.map((_, i) => (n === 1 ? H / 2 : top + (span * i) / (n - 1)))
    const bx = W * 0.47
    return (
      <div className={'pitch-slide ov-side' + (anim ? ' anim' : '')}>
        <Crumbs crumbs={slide.crumbs} H={H} />
        <div className="pitch-head side" style={{ fontSize: headFs, width: W * 0.36, left: W * 0.08 }}>{topic.title}</div>
        {shown.length > 0 && (
          <svg className="pitch-lines" width={W} height={H} style={{ strokeWidth: Math.max(1.5, H * 0.0046) }}>
            {layout === 'list'
              ? (() => {
                  const y0 = n === 1 ? H * 0.4 : top - itemFs * 0.6, y1 = n === 1 ? H * 0.6 : bottom + itemFs * 0.6, ym = H / 2, r = Math.min(14, (y1 - y0) / 6)
                  return <path d={`M${bx + r},${y0} Q${bx},${y0} ${bx},${y0 + r} L${bx},${ym - r} Q${bx},${ym} ${bx - r},${ym} Q${bx},${ym} ${bx},${ym + r} L${bx},${y1 - r} Q${bx},${y1} ${bx + r},${y1}`} />
                })()
              : shown.map((_, i) => <path key={i} d={`M${W * 0.44},${H / 2} C${W * 0.5},${H / 2} ${W * 0.48},${ys[i]} ${W * 0.54},${ys[i]}`} />)}
          </svg>
        )}
        {shown.map((it, i) => (
          <div key={it.id} className={'pitch-item side' + (anim ? ' anim' : '')}
            style={{ fontSize: itemFs, left: W * (layout === 'list' ? 0.5 : 0.56), top: ys[i], maxWidth: W * 0.42 }}>{it.title}</div>
        ))}
      </div>
    )
  }
  return (
    <div className={'pitch-slide ov-' + layout + (anim ? ' anim' : '')} style={{ padding: `${H * 0.1}px ${W * 0.08}px` }}>
      <Crumbs crumbs={slide.crumbs} H={H} />
      <div className="pitch-head" style={{ fontSize: headFs }}>{topic.title}</div>
      <div className="pitch-items" style={{ gap: itemFs * 0.45 }}>{itemsEl('pitch-item')}</div>
    </div>
  )
}

const Tri = ({ d }: { d: string }) => <svg width={10} height={12} viewBox="0 0 10 12"><path d={d} fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" /></svg>
const TriO = ({ d }: { d: string }) => <svg width={10} height={12} viewBox="0 0 10 12"><path d={d} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" /></svg>

export default function Presentation({ sheet: realSheet }: { sheet: Sheet }) {
  const ed = useEditor.getState
  const drillId = useEditor(s => s.drillId)
  const peers = useCollab(s => s.peers)
  const sheet = useMemo(() => displaySheet(realSheet, drillId), [realSheet, drillId])
  const slides = useMemo(() => buildSlides(sheet.rootTopic), [sheet])
  const [pos, setPos] = useState({ i: 0, step: 0 })
  const [dark, setDark] = useState((realSheet.pitchTheme ?? 'dark') === 'dark')
  const [ratio, setRatio] = useState(realSheet.pitchRatio ?? 'auto')
  const [anim, setAnim] = useState(realSheet.pitchAnimation ?? true)
  const [pop, setPop] = useState<null | 'settings' | 'viewers'>(null)
  const [fs, setFs] = useState(false)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => root.current && setVp({ w: root.current.clientWidth, h: root.current.clientHeight }))
    if (root.current) ro.observe(root.current)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const r = ratio === 'auto' ? vp.w / vp.h : RATIOS[ratio]
  const W = Math.round(Math.min(vp.w, vp.h * r)), H = Math.round(W / r)
  const slide = slides[Math.min(pos.i, slides.length - 1)]

  const nextStep = () => setPos(({ i, step }) => (step < stepsOf(slides[i]) ? { i, step: step + 1 } : i < slides.length - 1 ? { i: i + 1, step: 0 } : { i, step }))
  const prevStep = () => setPos(({ i, step }) => (step > 0 ? { i, step: step - 1 } : i > 0 ? { i: i - 1, step: stepsOf(slides[i - 1]) } : { i, step }))
  const nextSlide = () => setPos(({ i }) => ({ i: Math.min(slides.length - 1, i + 1), step: 0 }))
  const prevSlide = () => setPos(({ i, step }) => ({ i: step > 0 ? i : Math.max(0, i - 1), step: 0 }))
  const exit = () => ed().setPresenting(false)
  const persist = (patch: Partial<Sheet>) => { try { ed().setSheet(patch) } catch { /* только просмотр */ } }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.('select')) return
      e.stopPropagation()
      if (['ArrowRight', 'ArrowDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); nextStep() }
      else if (['ArrowLeft', 'ArrowUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prevStep() }
      else if (e.key === 'PageDown') { e.preventDefault(); nextSlide() }
      else if (e.key === 'PageUp') { e.preventDefault(); prevSlide() }
      else if (e.key === 'Home') setPos({ i: 0, step: 0 })
      else if (e.key === 'End') setPos({ i: slides.length - 1, step: stepsOf(slides[slides.length - 1]) })
      else if (e.key === 'Escape') { if (pop) setPop(null); else if (!document.fullscreenElement) exit() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const last = pos.i === slides.length - 1 && pos.step >= stepsOf(slide)
  return (
    <div className={'pitch' + (dark ? ' dark' : ' light')} ref={root} data-testid="presentation"
      onClick={e => { if ((e.target as Element).closest('.pitch-ui')) return; if (pop) setPop(null); else nextStep() }}>
      <div className="pitch-stage" style={{ width: W, height: H }} data-slide={pos.i + 1} data-step={pos.step}>
        <SlideView key={pos.i} slide={slide} step={pos.step} W={W} H={H} anim={anim} />
      </div>

      <div className="pitch-ui pitch-top">
        <button className="pitch-btn" aria-label="Зрители" onClick={() => setPop(p => (p === 'viewers' ? null : 'viewers'))}>
          <svg width={14} height={14} viewBox="0 0 16 16"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth={1.3} /><circle cx={8} cy={8} r={2} fill="currentColor" /></svg>
          <span>{peers.length + 1}</span>
        </button>
        <div className="pitch-group">
          <button className={'pitch-btn' + (pop === 'settings' ? ' on' : '')} aria-label="Настройки" title="Настройки" onClick={() => setPop(p => (p === 'settings' ? null : 'settings'))}>
            <Icon name="settings" size={14} />
          </button>
          <button className="pitch-btn" aria-label={fs ? 'Выйти из полноэкранного режима' : 'Полный экран'} title={fs ? 'Выйти из полноэкранного режима' : 'Полный экран'}
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())?.catch?.(() => {})}>
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
              {fs ? <path d="M9.5 6.5L14 2M9.5 6.5V3.5M9.5 6.5h3M6.5 9.5L2 14M6.5 9.5v3M6.5 9.5h-3" /> : <path d="M9.5 6.5L14 2M14 2h-3M14 2v3M6.5 9.5L2 14M2 14h3M2 14v-3" />}
            </svg>
          </button>
          <button className="pitch-btn" aria-label="Выйти из презентации" title="Выйти (Esc)" onClick={exit}>
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5h-6v11h6M7 8h7.5M12 5.5L14.5 8 12 10.5" /></svg>
          </button>
        </div>
        {pop === 'viewers' && (
          <div className="pitch-pop viewers">
            <div className="pv-row"><span className="pv-dot" style={{ background: '#ff9f69' }} />Вы</div>
            {peers.map(p => <div key={p.clientId} className="pv-row"><span className="pv-dot" style={{ background: p.color }} />{p.name}</div>)}
          </div>
        )}
        {pop === 'settings' && (
          <div className="pitch-pop" role="dialog" aria-label="Настройки презентации">
            <b>Настройки</b>
            <button className="pitch-wide" onClick={() => { setDark(!dark); persist({ pitchTheme: dark ? 'light' : 'dark' }) }}>Сменить тему</button>
            <label className="pitch-row">Соотношение сторон
              <select value={ratio} onChange={e => { const v = e.target.value as NonNullable<Sheet['pitchRatio']>; setRatio(v); persist({ pitchRatio: v }) }} aria-label="Соотношение сторон">
                <option value="auto">Авто</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="9:16">9:16</option><option value="3:4">3:4</option>
              </select>
            </label>
            <label className="pitch-check"><input type="checkbox" checked={anim} onChange={e => { setAnim(e.target.checked); persist({ pitchAnimation: e.target.checked }) }} />Анимация</label>
          </div>
        )}
      </div>

      <div className="pitch-ui pitch-nav">
        <button className="pitch-btn" aria-label="Предыдущий слайд" title="Предыдущий слайд (PgUp)" disabled={pos.i === 0 && pos.step === 0} onClick={prevSlide}><Tri d="M8 1.5v9L1.5 6z" /></button>
        <i />
        <button className="pitch-btn" aria-label="Назад" title="Назад (←)" disabled={pos.i === 0 && pos.step === 0} onClick={prevStep}><TriO d="M8 1.5v9L1.5 6z" /></button>
        <i />
        <button className="pitch-btn" aria-label="Вперёд" title="Вперёд (→)" disabled={last} onClick={nextStep}><TriO d="M2 1.5v9L8.5 6z" /></button>
        <i />
        <button className="pitch-btn" aria-label="Следующий слайд" title="Следующий слайд (PgDn)" disabled={pos.i === slides.length - 1} onClick={nextSlide}><Tri d="M2 1.5v9L8.5 6z" /></button>
      </div>
    </div>
  )
}
