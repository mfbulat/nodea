// Презентация (аналог Pitch): слайды строятся автоматически — обзор карты,
// затем по слайду на каждую ветку с подтемами (в порядке обхода). Переходы — плавная
// анимация масштаба и сдвига, остальная карта приглушается.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Sheet, Topic } from './model'
import MapCanvas, { canvasApi, displaySheet } from './MapCanvas'
import { useEditor } from './store'
import { subtreeIds } from './layout'

interface Slide { title: string; focus: Set<string> | null; view: string[] | null }

function buildSlides(sheet: Sheet): Slide[] {
  const slides: Slide[] = [{ title: sheet.rootTopic.title, focus: null, view: null }]
  const walk = (t: Topic, path: string[]) => {
    for (const c of t.children ?? []) {
      if (c.children?.length) {
        const sub = [...subtreeIds({ ...c, collapsed: false })]
        slides.push({ title: c.title, focus: new Set([...path, t.id, ...sub]), view: sub })
        walk(c, [...path, t.id])
      }
    }
  }
  walk(sheet.rootTopic, [])
  return slides
}

export default function Presentation({ sheet: realSheet }: { sheet: Sheet }) {
  const ed = useEditor.getState
  const drillId = useEditor(s => s.drillId)
  const sheet = useMemo(() => displaySheet(realSheet, drillId), [realSheet, drillId])
  const slides = useMemo(() => buildSlides(sheet), [sheet])
  const [i, setI] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => {})
    const onFs = () => { if (!document.fullscreenElement) ed().setPresenting(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    // даём холсту отрисоваться перед анимацией
    const t = setTimeout(() => canvasApi.animateTo(slides[i]?.view ?? null, i === 0 ? 400 : 700), 60)
    return () => clearTimeout(t)
  }, [i, slides])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); setI(x => Math.min(slides.length - 1, x + 1)) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setI(x => Math.max(0, x - 1)) }
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(slides.length - 1)
      else if (e.key === 'Escape') ed().setPresenting(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [slides.length])

  return (
    <div className="presentation" ref={root} data-testid="presentation"
      onClick={e => { if (!(e.target as Element).closest('.pres-controls')) setI(x => Math.min(slides.length - 1, x + 1)) }}>
      <MapCanvas sheet={realSheet} readOnly focusIds={slides[i]?.focus ?? null} />
      <div className="pres-controls">
        <button onClick={() => setI(x => Math.max(0, x - 1))} disabled={i === 0} aria-label="Назад">‹</button>
        <span>{i + 1} / {slides.length} · {slides[i]?.title}</span>
        <button onClick={() => setI(x => Math.min(slides.length - 1, x + 1))} disabled={i === slides.length - 1} aria-label="Вперёд">›</button>
        <button onClick={() => ed().setPresenting(false)}>Выйти (Esc)</button>
      </div>
    </div>
  )
}
