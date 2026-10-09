import type { Box, Pt } from './layout'
import type { Relationship } from './model'

const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

/** Точка выхода луча из центра прямоугольника в направлении toward */
function clip(b: Box, toward: Pt): Pt {
  const c = center(b)
  const dx = toward.x - c.x, dy = toward.y - c.y
  if (!dx && !dy) return c
  const tx = dx ? (b.w / 2 + 3) / Math.abs(dx) : Infinity
  const ty = dy ? (b.h / 2 + 3) / Math.abs(dy) : Infinity
  const t = Math.min(tx, ty)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

export function defaultControls(b1: Box, b2: Box) {
  const c1 = center(b1), c2 = center(b2)
  const dx = c2.x - c1.x, dy = c2.y - c1.y
  const len = Math.hypot(dx, dy) || 1
  // смещаем кривую вбок, чтобы она не совпадала с ветками
  const nx = -dy / len, ny = dx / len
  const k = Math.min(120, len * 0.35)
  return {
    cp1: { x: dx / 3 + nx * k, y: dy / 3 + ny * k },
    cp2: { x: -dx / 3 + nx * k, y: -dy / 3 + ny * k },
  }
}

export interface RelGeom { p1: Pt; c1: Pt; c2: Pt; p2: Pt; mid: Pt; d: string; arrowEnd: string; arrowStart: string }

const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

function arrow(tip: Pt, from: Pt, size: number) {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x)
  const l = { x: tip.x - size * Math.cos(a - 0.45), y: tip.y - size * Math.sin(a - 0.45) }
  const r = { x: tip.x - size * Math.cos(a + 0.45), y: tip.y - size * Math.sin(a + 0.45) }
  return `M${tip.x},${tip.y}L${l.x},${l.y}L${r.x},${r.y}Z`
}

export function relGeometry(r: Relationship, boxes: Map<string, Box>): RelGeom | null {
  const b1 = boxes.get(r.end1), b2 = boxes.get(r.end2)
  if (!b1 || !b2) return null
  const def = defaultControls(b1, b2)
  const o1 = center(b1), o2 = center(b2)
  const cp1 = r.cp1 ?? def.cp1, cp2 = r.cp2 ?? def.cp2
  const c1 = { x: o1.x + cp1.x, y: o1.y + cp1.y }
  const c2 = { x: o2.x + cp2.x, y: o2.y + cp2.y }
  const p1 = clip(b1, c1), p2 = clip(b2, c2)
  const w = r.width ?? 2
  return {
    p1, c1, c2, p2, mid: bez(p1, c1, c2, p2, 0.5),
    d: `M${p1.x},${p1.y}C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`,
    arrowEnd: arrow(p2, c2, 8 + w * 2),
    arrowStart: arrow(p1, c1, 8 + w * 2),
  }
}

export { center as boxCenter }
