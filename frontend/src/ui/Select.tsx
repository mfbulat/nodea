// Выпадающий список как в веб-версии (вместо нативного <select>): кнопка 24 px с шевроном,
// список поверх интерфейса (портал) шириной не меньше кнопки, галочка у выбранного пункта,
// у краёв окна переворачивается вверх; клавиши ↑ ↓ Enter Esc.
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<T> { value: T; label: ReactNode; disabled?: boolean }

export function Select<T extends string | number>({ value, options, onChange, className = '', label, title, display, disabled, minWidth = 0 }: {
  value: T
  options: SelectOption<T>[]
  onChange: (v: T) => void
  className?: string
  /** доступное имя (aria-label) */
  label: string
  title?: string
  /** своё содержимое кнопки вместо подписи выбранного пункта */
  display?: ReactNode
  disabled?: boolean
  /** минимальная ширина списка (у узких кнопок список шире кнопки) */
  minWidth?: number
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const cur = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(false) }
    const away = () => setOpen(false)
    window.addEventListener('pointerdown', down)
    window.addEventListener('resize', away)
    const scroller = btn.current?.closest('.fp-scroll, .side-panel')
    scroller?.addEventListener('scroll', away)
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('resize', away); scroller?.removeEventListener('scroll', away) }
  }, [open])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = btn.current!.getBoundingClientRect(), h = pop.current!.offsetHeight
    const width = Math.max(r.width, minWidth)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    let top = r.bottom + 8
    if (top + h > window.innerHeight - 8) top = r.top - h - 8 >= 8 ? r.top - h - 8 : Math.max(8, window.innerHeight - h - 8)
    setPos({ left, top, width })
    setActive(options.findIndex(o => o.value === value))
  }, [open])

  // выбранный пункт виден сразу после открытия длинного списка
  useEffect(() => {
    if (!open || !pos) return
    pop.current?.querySelector<HTMLElement>('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  }, [open, pos])

  const pick = (o: SelectOption<T>) => { if (o.disabled) return; setOpen(false); if (o.value !== value) onChange(o.value); btn.current?.focus() }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      const d = e.key === 'ArrowDown' ? 1 : -1
      let i = active
      for (let k = 0; k < options.length; k++) { i = (i + d + options.length) % options.length; if (!options[i].disabled) break }
      setActive(i)
      return
    }
    if ((e.key === 'Enter' || e.key === ' ') && open && options[active]) { e.preventDefault(); pick(options[active]) }
  }

  return (
    <>
      <button ref={btn} type="button" className={'sel ' + className + (open ? ' open' : '')} aria-label={label} title={title} aria-haspopup="listbox" aria-expanded={open}
        disabled={disabled} onClick={() => setOpen(o => !o)} onKeyDown={onKey}>
        <span className="sel-label">{display ?? cur?.label ?? ''}</span>
        <svg className="sel-chev" width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 4.25 6 8.25l4.5-4" /></svg>
      </button>
      {open && createPortal(
        <div ref={pop} className="sel-pop" role="listbox" aria-label={label} onKeyDown={onKey}
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width, visibility: pos ? 'visible' : 'hidden' }}>
          {options.map((o, i) => (
            <button key={String(o.value)} type="button" role="option" aria-selected={o.value === value} disabled={o.disabled}
              className={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onClick={() => pick(o)}>
              <span className="sel-check">{o.value === value && <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.2l2.6 2.6L11 4.4" /></svg>}</span>
              <span className="sel-text">{o.label}</span>
            </button>
          ))}
        </div>, document.body)}
    </>
  )
}
