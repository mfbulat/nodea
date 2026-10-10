// Выбор цвета как в веб-версии: сетка 9×5 стандартных цветов, поле HEX и прозрачность в %,
// радужная кнопка — системный выбор любого цвета, ниже «Current Theme» — цвета текущей цветовой темы.
// Окно открывается слева от образца (по центру по вертикали), поверх интерфейса.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const GRID_COLORS = [
  '#ffffff', '#eeeeee', '#d0d0d0', '#adadad', '#999999', '#666666', '#333333', '#111111', '#000000',
  '#fdd834', '#ff9595', '#8ede99', '#0ce6cf', '#8eddf9', '#50c3f7', '#7986cb', '#ba69c8', '#ffabd5',
  '#ffc009', '#ff5252', '#2cd551', '#00a99d', '#2abee0', '#05a8f4', '#4051b5', '#9c27b0', '#ea8aba',
  '#ff9f00', '#ff3c00', '#19a719', '#007c74', '#0096bf', '#0288d1', '#303e9f', '#7b1fa2', '#ce4289',
  '#ff6f00', '#e32c2d', '#15831c', '#025a5a', '#00526b', '#00579b', '#1a227e', '#4a148c', '#a34075',
]

/** #rgb / #rrggbb / #rrggbbaa → { hex: 'RRGGBB', alpha: 0..100 } */
export function parseColor(c: string): { hex: string; alpha: number } {
  let h = (c || '').replace('#', '').trim()
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return { hex: 'FFFFFF', alpha: 100 }
  const alpha = h.length === 8 ? Math.round(parseInt(h.slice(6), 16) / 2.55) : 100
  return { hex: h.slice(0, 6).toUpperCase(), alpha }
}
const toColor = (hex: string, alpha: number) =>
  '#' + hex.toLowerCase() + (alpha >= 100 ? '' : Math.round(Math.max(0, alpha) * 2.55).toString(16).padStart(2, '0'))

export function ColorPicker({ value, onChange, themeColors, label = 'Color', className = '' }: {
  value: string; onChange: (v: string) => void; themeColors?: string[]; label?: string; className?: string
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const none = value === 'transparent' || value === 'none'
  const cur = parseColor(none ? '#ffffff' : value)
  const [hex, setHex] = useState(cur.hex)
  const [alpha, setAlpha] = useState(String(cur.alpha))
  useEffect(() => { setHex(cur.hex); setAlpha(String(cur.alpha)) }, [value, open])

  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', down); window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key) }
  }, [open])
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = btn.current!.getBoundingClientRect(), w = pop.current!.offsetWidth, h = pop.current!.offsetHeight
    let left = r.left - 8 - w
    if (left < 8) left = Math.min(r.right + 8, window.innerWidth - w - 8)
    const top = Math.max(8, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - 8))
    setPos({ left, top })
  }, [open])

  const pick = (c: string) => { onChange(toColor(parseColor(c).hex, +alpha || 100)); }
  const commitHex = () => { if (/^[0-9a-f]{6}$/i.test(hex)) onChange(toColor(hex, +alpha || 0)); else setHex(cur.hex) }
  const commitAlpha = () => { const a = Math.max(0, Math.min(100, Math.round(+alpha))); if (Number.isFinite(a)) { setAlpha(String(a)); onChange(toColor(cur.hex, a)) } else setAlpha(String(cur.alpha)) }
  const sel = (c: string) => !none && parseColor(c).hex === cur.hex

  return (
    <>
      <button ref={btn} type="button" className={'cp-well ' + className + (open ? ' open' : '')} aria-label={label} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span style={{ background: none ? 'repeating-linear-gradient(45deg,#fff 0 4px,#ddd 4px 8px)' : value }} />
      </button>
      {open && createPortal(
        <div ref={pop} className="cp-pop" role="dialog" aria-label={label}
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          <div className="cp-main">
            <div className="cp-grid">
              {GRID_COLORS.map(c => <button key={c} type="button" className={sel(c) ? 'on' : ''} style={{ background: c }} aria-label={c} title={c.toUpperCase()} onClick={() => pick(c)} />)}
            </div>
            <div className="cp-custom">
              <label className="cp-hex">
                <i style={{ background: none ? '#fff' : value }} />
                <input value={hex} maxLength={6} aria-label="Hex" spellCheck={false}
                  onChange={e => setHex(e.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase())} onBlur={commitHex}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitHex() }} />
                <b />
                <input className="cp-alpha" value={alpha} maxLength={3} aria-label="Opacity"
                  onChange={e => setAlpha(e.target.value.replace(/\D/g, ''))} onBlur={commitAlpha}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitAlpha() }} />
                <span>%</span>
              </label>
              <label className="cp-wheel" title="More Colors">
                <input type="color" aria-label="More Colors" value={'#' + cur.hex.toLowerCase()} onChange={e => pick(e.target.value)} />
              </label>
            </div>
          </div>
          {!!themeColors?.length && <div className="cp-theme">
            <div className="cp-cap">Current Theme</div>
            <div className="cp-grid">
              {themeColors.map((c, i) => <button key={c + i} type="button" className={sel(c) ? 'on' : ''} style={{ background: c }} aria-label={c} title={c.toUpperCase()} onClick={() => pick(c)} />)}
            </div>
          </div>}
        </div>, document.body)}
    </>
  )
}
