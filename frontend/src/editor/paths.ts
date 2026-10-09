import type { Edge, Pt } from './layout'
import type { LineShape, ShapeId } from './model'

/** Контур темы заданной формы в прямоугольнике w×h */
export function shapePath(shape: ShapeId, w: number, h: number): string {
  switch (shape) {
    case 'rect': return `M0,0H${w}V${h}H0Z`
    case 'rounded': return roundRect(w, h, Math.min(8, h / 2))
    case 'capsule': return roundRect(w, h, h / 2)
    case 'ellipse': return `M0,${h / 2}A${w / 2},${h / 2} 0 1 0 ${w},${h / 2}A${w / 2},${h / 2} 0 1 0 0,${h / 2}Z`
    case 'diamond': return `M${w / 2},0L${w},${h / 2}L${w / 2},${h}L0,${h / 2}Z`
    case 'hexagon': { const d = Math.min(16, w / 4); return `M${d},0H${w - d}L${w},${h / 2}L${w - d},${h}H${d}L0,${h / 2}Z` }
    case 'parallelogram': { const d = Math.min(16, w / 4); return `M${d},0H${w}L${w - d},${h}H0Z` }
    default: return `M0,0H${w}V${h}H0Z`
  }
}

function roundRect(w: number, h: number, r: number) {
  return `M${r},0H${w - r}A${r},${r} 0 0 1 ${w},${r}V${h - r}A${r},${r} 0 0 1 ${w - r},${h}H${r}A${r},${r} 0 0 1 0,${h - r}V${r}A${r},${r} 0 0 1 ${r},0Z`
}

const f = (n: number) => Math.round(n * 10) / 10

/** Путь линии ветки. Для taper возвращает замкнутую фигуру (заливка). */
export function edgePath(e: Edge, shape: LineShape, width: number): { d: string; filled: boolean } {
  if (shape === 'none') return { d: '', filled: false }
  const [a, b] = e.pts
  if (e.kind === 'line') return { d: `M${f(a.x)},${f(a.y)}L${f(b.x)},${f(b.y)}`, filled: false }
  if (e.kind === 'vbrace') {
    // та же скобка, повёрнутая на 90°
    const sw = (p: Pt): Pt => ({ x: p.y, y: p.x })
    const r = edgePath({ ...e, kind: 'brace', pts: e.pts.map(sw) }, shape, width)
    return { d: r.d.replace(/(-?[\d.]+),(-?[\d.]+)/g, '$2,$1').replace(/([VH])(-?[\d.]+)/g, (_, c, n) => (c === 'V' ? 'H' : 'V') + n), filled: false }
  }
  if (e.kind === 'brace') {
    // «{»: острие у родителя (x0), концы — у детей (x2)
    const [top, mid, bottom] = e.pts
    const x0 = top.x, x2 = mid.x, xm = (x0 + x2) / 2
    const r = Math.min(8, (bottom.y - top.y) / 4)
    return { d: `M${f(x2)},${f(top.y)}Q${f(xm)},${f(top.y)} ${f(xm)},${f(top.y + r)}V${f(mid.y - r)}Q${f(xm)},${f(mid.y)} ${f(x0)},${f(mid.y)}`
      + `Q${f(xm)},${f(mid.y)} ${f(xm)},${f(mid.y + r)}V${f(bottom.y - r)}Q${f(xm)},${f(bottom.y)} ${f(x2)},${f(bottom.y)}`, filled: false }
  }
  if (e.kind === 'tree') {
    if (shape === 'straight') return { d: `M${f(a.x)},${f(a.y)}L${f(b.x)},${f(b.y)}`, filled: false }
    if (shape === 'curve' || shape === 'taper' || shape === 'rounded') {
      const r = Math.min(10, Math.abs(b.y - a.y) / 2, Math.abs(b.x - a.x))
      const sy = Math.sign(b.y - a.y), sx = Math.sign(b.x - a.x)
      return { d: `M${f(a.x)},${f(a.y)}V${f(b.y - sy * r)}Q${f(a.x)},${f(b.y)} ${f(a.x + sx * r)},${f(b.y)}H${f(b.x)}`, filled: false }
    }
    return { d: `M${f(a.x)},${f(a.y)}V${f(b.y)}H${f(b.x)}`, filled: false }
  }
  const vertical = e.kind === 'v'
  // главная ось: h — по x, v — по y
  const P = (u: number, v: number): Pt => (vertical ? { x: v, y: u } : { x: u, y: v })
  const au = vertical ? a.y : a.x, av = vertical ? a.x : a.y
  const bu = vertical ? b.y : b.x, bv = vertical ? b.x : b.y
  const mu = (au + bu) / 2
  const pt = (p: Pt) => `${f(p.x)},${f(p.y)}`
  // ветка от центральной темы: начинается под темой, уходит вертикально и подходит к теме горизонтально
  if (e.fromRoot && (shape === 'curve' || shape === 'rounded' || shape === 'elbow')) {
    if (!vertical) return { d: `M${pt(a)}Q${f(a.x + (b.x - a.x) * 0.2)},${f(b.y)} ${pt(b)}`, filled: false }
  }
  // отвод к подтемам — короткий, у самого родителя (ствол не посередине)
  const su0 = Math.sign(bu - au) || 1
  const trunk = au + su0 * Math.min(12, Math.abs(bu - au) / 2)
  switch (shape) {
    case 'straight': return { d: `M${pt(a)}L${pt(b)}`, filled: false }
    case 'elbow': return { d: `M${pt(a)}L${pt(P(trunk, av))}L${pt(P(trunk, bv))}L${pt(b)}`, filled: false }
    case 'rounded': {
      const mu = trunk
      const r = Math.min(10, Math.abs(bv - av) / 2, Math.abs(bu - mu))
      const su = su0, sv = Math.sign(bv - av)
      if (!sv) return { d: `M${pt(a)}L${pt(b)}`, filled: false }
      return { d: `M${pt(a)}L${pt(P(mu - su * r, av))}Q${pt(P(mu, av))} ${pt(P(mu, av + sv * r))}L${pt(P(mu, bv - sv * r))}Q${pt(P(mu, bv))} ${pt(P(mu + su * r, bv))}L${pt(b)}`, filled: false }
    }
    case 'taper': {
      const w0 = Math.max(width * 2.5, 5) / 2, w1 = Math.max(width / 2, 0.5)
      const c1 = P(mu, av), c2 = P(mu, bv)
      const o = (p: Pt, d: number) => (vertical ? { x: p.x + d, y: p.y } : { x: p.x, y: p.y + d })
      return { d: `M${pt(o(a, -w0))}C${pt(o(c1, -w0))} ${pt(o(c2, -w1))} ${pt(o(b, -w1))}L${pt(o(b, w1))}C${pt(o(c2, w1))} ${pt(o(c1, w0))} ${pt(o(a, w0))}Z`, filled: true }
    }
    default: return { d: `M${pt(a)}C${pt(P(mu, av))} ${pt(P(mu, bv))} ${pt(b)}`, filled: false }
  }
}
