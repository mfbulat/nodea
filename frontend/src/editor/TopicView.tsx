import type { Box } from './layout'
import type { Topic } from './model'
import type { FullStyle } from './themes'
import type { Content, IconKind } from './measure'
import { shapePath } from './paths'
import { MarkerIcon } from './markers'

export function dashOf(style: string | undefined, w: number) {
  return style === 'dashed' ? `${w * 4} ${w * 3}` : style === 'dotted' ? `${w} ${w * 2}` : undefined
}

function Icon({ kind, x, y, size, color, topic, onIcon }: {
  kind: IconKind; x: number; y: number; size: number; color: string; topic: Topic
  onIcon: (kind: IconKind, e: React.MouseEvent) => void
}) {
  const k = size / 16
  let body: JSX.Element
  switch (kind) {
    case 'task': {
      const done = !!topic.task?.done
      body = <><rect x={1.5} y={1.5} width={13} height={13} rx={2.5} fill={done ? '#30a46c' : '#fff'} stroke={done ? '#30a46c' : '#8b8d98'} strokeWidth={1.5} />
        {done && <path d="M4.2,8.2l2.6,2.6l5,-5.6" stroke="#fff" strokeWidth={1.9} fill="none" strokeLinecap="round" />}</>
      break
    }
    case 'link':
      body = topic.href?.startsWith('topic:')
        ? <><circle cx={8} cy={8} r={7} fill="none" stroke={color} strokeWidth={1.4} /><path d="M5,8H11M8.5,5.5L11,8L8.5,10.5" stroke={color} strokeWidth={1.5} fill="none" /></>
        : <path d="M6.6,9.4L9.4,6.6M7.2,4.6L8.6,3.2A2.6,2.6 0 0 1 12.8,7.4L11.4,8.8M8.8,11.4L7.4,12.8A2.6,2.6 0 0 1 3.2,8.6L4.6,7.2"
          stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      break
    case 'note':
      body = <path d="M3 4.5h10M3 8h10M3 11.5h6" stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.75} />
      break
    case 'attachment':
      body = <path d="M10.5,4.5L5.2,9.8A1.6,1.6 0 0 0 7.5,12.1L12.6,7A3,3 0 0 0 8.4,2.8L3.4,7.8A4.4,4.4 0 0 0 9.6,14"
        stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      break
    case 'comments':
      body = <><path d="M2,3.5A1.5,1.5 0 0 1 3.5,2H12.5A1.5,1.5 0 0 1 14,3.5V10A1.5,1.5 0 0 1 12.5,11.5H7L4,14V11.5H3.5A1.5,1.5 0 0 1 2,10Z" fill="#e8f1ff" stroke="#3e63dd" strokeWidth={1.2} />
        <text x={8} y={9.4} textAnchor="middle" fontSize={7} fontWeight={700} fill="#3e63dd" fontFamily="system-ui">{topic.comments?.length}</text></>
      break
    default: body = <></>
  }
  return (
    <g transform={`translate(${x},${y}) scale(${k})`} className={'topic-icon icon-' + kind} style={{ cursor: 'pointer' }}
      onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onIcon(kind, e) }}>
      <rect width={16} height={16} fill="transparent" />
      <title>{kind === 'link' ? topic.href : kind === 'note' ? topic.notes?.plain : kind === 'attachment' ? topic.attachment?.name : ''}</title>
      {body}
    </g>
  )
}

export function TopicNode({ box, topic, style: s, content: c, selected, dim, hidden, central, relTarget, equationImage, highlight, current,
  onPointerDown, onDoubleClick, onIcon, onMarker }: {
  box: Box; topic: Topic; style: FullStyle; content: Content
  selected: boolean; dim: boolean; hidden: boolean; central: boolean; relTarget?: boolean
  /** найдено поиском / текущий результат */
  highlight?: boolean; current?: boolean
  /** для экспорта: формула, заранее отрисованная в картинку */
  equationImage?: string
  onPointerDown: (e: React.PointerEvent) => void; onDoubleClick: (e: React.MouseEvent) => void
  onIcon: (kind: IconKind, e: React.MouseEvent) => void; onMarker: (id: string) => void
}) {
  const shape = box.cell ? 'rect' : s.shape
  const dash = dashOf(s.borderStyle, s.borderWidth)
  const stroke = s.borderStyle === 'none' ? 'none' : s.borderColor
  const fill = s.fill === 'transparent' ? 'rgba(0,0,0,0)' : s.fill
  // в ячейках таблицы контент центрируется в растянутом боксе
  // ячейки таблицы растягиваются — содержимое центрируется; обычная тема рисуется по своей фигуре
  const sw = box.cell ? box.w : c.shapeW, sh = box.cell ? box.h : c.shapeH
  const ox = box.cell ? (box.w - c.shapeW) / 2 : 0, oy = box.cell ? (box.h - c.shapeH) / 2 : 0
  const r = Math.min(8, sh / 2) + 4
  const t = c.text
  const tx = t ? (s.textAlign === 'left' ? t.x : s.textAlign === 'right' ? t.x + t.textW : t.x + t.textW / 2) : 0
  const anchor = s.textAlign === 'left' ? 'start' : s.textAlign === 'right' ? 'end' : 'middle'
  return (
    <g className="topic" data-id={topic.id} data-central={central || undefined} transform={`translate(${box.x},${box.y})`}
      opacity={dim ? 0.2 : 1} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} style={{ cursor: 'pointer', transition: 'opacity .4s' }}>
      {highlight && <rect x={-6} y={-6} width={sw + 12} height={sh + 12} rx={r + 2} fill={current ? '#ffd24d' : '#fff1b8'} opacity={0.9} />}
      {(selected || relTarget) && <rect x={-4} y={-4} width={sw + 8} height={sh + 8} rx={r} fill="none"
        stroke="var(--color-selection)" strokeWidth={2} strokeDasharray={relTarget ? '4 3' : undefined} />}
      {shape === 'underline' ? (
        <>
          <rect width={sw} height={sh} fill={fill} />
          <line x1={0} x2={sw} y1={sh} y2={sh} stroke={stroke === 'none' ? s.lineColor : stroke}
            strokeWidth={Math.max(s.borderWidth, s.lineWidth)} strokeDasharray={dash} />
        </>
      ) : shape === 'none' ? (
        <rect width={sw} height={sh} fill={fill} />
      ) : (
        <path d={shapePath(shape, sw, sh)} fill={fill} stroke={stroke} strokeWidth={s.borderWidth} strokeDasharray={dash} />
      )}
      <g transform={`translate(${ox},${oy})`}>
        {c.image && (c.image.src.startsWith('emoji:')
          ? <text x={c.image.x + c.image.w / 2} y={c.image.y + c.image.h * 0.82} textAnchor="middle" fontSize={c.image.h * 0.9}
            style={{ userSelect: 'none' }}>{c.image.src.slice(6)}</text>
          : <image href={c.image.src} x={c.image.x} y={c.image.y} width={c.image.w} height={c.image.h} preserveAspectRatio="xMidYMid meet" />)}
        {c.icons.map((ic, i) => ic.kind === 'marker'
          ? <g key={i} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMarker(ic.id!) }} style={{ cursor: 'pointer' }}>
            <MarkerIcon id={ic.id!} x={ic.x} y={ic.y} size={ic.size} /></g>
          : <Icon key={i} kind={ic.kind} x={ic.x} y={ic.y} size={ic.size} color={s.textColor} topic={topic} onIcon={onIcon} />)}
        {t && !hidden && (
          <text x={tx} y={t.y + t.lineHeight * 0.78} textAnchor={anchor} fill={s.textColor} fontFamily={s.fontFamily} fontSize={s.fontSize}
            fontWeight={s.fontWeight} fontStyle={s.fontStyle} textDecoration={s.textDecoration}
            style={{ userSelect: 'none', whiteSpace: 'pre' }}>
            {t.lines.map((l, i) => <tspan key={i} x={tx} dy={i ? t.lineHeight : 0}>{l}</tspan>)}
          </text>
        )}
        {c.equation && equationImage && (
          <image href={equationImage} x={c.equation.x} y={c.equation.y} width={c.equation.w} height={c.equation.h} />
        )}
        {c.equation && !equationImage && (
          <foreignObject x={c.equation.x} y={c.equation.y} width={c.equation.w} height={c.equation.h} style={{ overflow: 'visible' }}>
            <div className="eq" style={{ fontSize: s.fontSize, color: s.textColor, whiteSpace: 'nowrap', padding: '2px 2px 0' }}
              dangerouslySetInnerHTML={{ __html: c.equation.html }} />
          </foreignObject>
        )}
        {c.labels.map((l, i) => (
          <g key={'l' + i}>
            <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={l.h / 2} fill="#ffffff" stroke="#d6d6d6" strokeWidth={1} />
            <text x={l.x + l.w / 2} y={l.y + l.h - 5} textAnchor="middle" fontSize={11} fill="#8a8a8a" fontFamily={s.fontFamily}>{l.text}</text>
          </g>
        ))}
      </g>
    </g>
  )
}
