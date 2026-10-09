// Собственный набор маркеров (рисуются примитивами SVG) и стикеров.
// В пределах группы маркеры взаимоисключающие, как в XMind.

export interface MarkerGroup { id: string; name: string; markers: string[] }

const COLORS: Record<string, string> = {
  red: '#e5484d', orange: '#f76b15', yellow: '#f5c400', green: '#30a46c', blue: '#0090ff',
  purple: '#8e4ec6', gray: '#8b8d98', pink: '#e93d82', teal: '#12a594',
}
const PRIORITY = ['#e5484d', '#f76b15', '#f5a300', '#30a46c', '#12a594', '#0090ff', '#3e63dd', '#8e4ec6', '#8b8d98']
const colorNames = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']

export const MARKER_GROUPS: MarkerGroup[] = [
  { id: 'tag', name: 'Тег', markers: colorNames.map(c => `tag-${c}`) },
  { id: 'priority', name: 'Приоритет', markers: [...Array(9).keys()].map(i => `priority-${i + 1}`) },
  { id: 'task', name: 'Прогресс', markers: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `task-${i}`) },
  { id: 'flag', name: 'Флажки', markers: colorNames.map(c => `flag-${c}`) },
  { id: 'star', name: 'Звёзды', markers: colorNames.map(c => `star-${c}`) },
  { id: 'smiley', name: 'Смайлы', markers: ['smiley-smile', 'smiley-laugh', 'smiley-sad', 'smiley-angry', 'smiley-surprise', 'smiley-neutral'] },
  { id: 'symbol', name: 'Символы', markers: ['symbol-plus', 'symbol-minus', 'symbol-question', 'symbol-exclam', 'symbol-info', 'symbol-check', 'symbol-cross', 'symbol-heart'] },
  { id: 'arrow', name: 'Стрелки', markers: ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-refresh'] },
  { id: 'person', name: 'Люди', markers: colorNames.map(c => `person-${c}`) },
  { id: 'month', name: 'Месяцы', markers: [...Array(12).keys()].map(i => `month-${i + 1}`) },
  { id: 'week', name: 'Дни недели', markers: [...Array(7).keys()].map(i => `week-${i + 1}`) },
]

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const markerGroup = (id: string) => id.split('-')[0]

export function markerName(id: string): string {
  const [g, v] = id.split('-')
  switch (g) {
    case 'priority': return `Приоритет ${v}`
    case 'tag': return ({ red: 'Красный', orange: 'Оранжевый', yellow: 'Жёлтый', green: 'Зелёный', blue: 'Синий', purple: 'Фиолетовый', gray: 'Серый' } as Record<string, string>)[v] ?? v
    case 'task': return `Выполнено ${Math.round((+v / 8) * 100)}%`
    case 'month': return MONTHS[+v - 1]
    case 'week': return WEEK[+v - 1]
    default: return id
  }
}

/** Иконка маркера 16×16 (масштабируется через size) */
export function MarkerIcon({ id, x = 0, y = 0, size = 16 }: { id: string; x?: number; y?: number; size?: number }) {
  const [g, v] = id.split('-')
  const k = size / 16
  const c = COLORS[v] ?? '#8b8d98'
  let body: JSX.Element
  switch (g) {
    case 'priority':
      body = <><circle cx={8} cy={8} r={8} fill={PRIORITY[+v - 1]} />
        <text x={8} y={11.8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">{v}</text></>
      break
    case 'task': {
      const p = +v / 8
      const a = p * Math.PI * 2
      const big = p > 0.5 ? 1 : 0
      body = <><circle cx={8} cy={8} r={7.2} fill="#fff" stroke="#30a46c" strokeWidth={1.6} />
        {p >= 1 ? <circle cx={8} cy={8} r={7.2} fill="#30a46c" />
          : p > 0 && <path d={`M8,8V0.8A7.2,7.2 0 ${big} 1 ${8 + 7.2 * Math.sin(a)},${8 - 7.2 * Math.cos(a)}Z`} fill="#30a46c" />}
        {p >= 1 && <path d="M4.5,8.3l2.4,2.4l4.6,-5" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" />}</>
      break
    }
    case 'tag':
      body = <circle cx={8} cy={8} r={7} fill={c} />
      break
    case 'flag':
      body = <><path d="M3,1.5V15" stroke="#555" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M3.6,2H13L10.6,5.5L13,9H3.6Z" fill={c} /></>
      break
    case 'star':
      body = <path d="M8,0.8l2.2,4.6l5,0.7l-3.6,3.5l0.9,5L8,12.2l-4.5,2.4l0.9,-5L0.8,6.1l5,-0.7Z" fill={c} />
      break
    case 'smiley': {
      const mouth: Record<string, string> = {
        smile: 'M4.8,9.6Q8,12.6 11.2,9.6', laugh: 'M4.6,9H11.4Q11,12.8 8,12.8Q5,12.8 4.6,9Z', sad: 'M5,12Q8,9.2 11,12',
        angry: 'M5,11.6Q8,10 11,11.6', surprise: '', neutral: 'M5,10.8H11',
      }
      body = <><circle cx={8} cy={8} r={7.6} fill="#f5c400" />
        <circle cx={5.5} cy={6} r={1.1} fill="#5a4300" /><circle cx={10.5} cy={6} r={1.1} fill="#5a4300" />
        {v === 'surprise' ? <circle cx={8} cy={10.8} r={1.8} fill="#5a4300" />
          : <path d={mouth[v]} stroke="#5a4300" strokeWidth={1.3} fill={v === 'laugh' ? '#5a4300' : 'none'} strokeLinecap="round" />}
        {v === 'angry' && <path d="M3.8,3.6L6.8,4.8M12.2,3.6L9.2,4.8" stroke="#5a4300" strokeWidth={1.2} />}</>
      break
    }
    case 'symbol': {
      const sym: Record<string, [string, string]> = {
        plus: ['#30a46c', 'M8,4V12M4,8H12'], minus: ['#e5484d', 'M4,8H12'], question: ['#0090ff', ''],
        exclam: ['#f76b15', ''], info: ['#3e63dd', ''], check: ['#30a46c', 'M4.3,8.4l2.6,2.6l4.8,-5.4'],
        cross: ['#e5484d', 'M5,5L11,11M11,5L5,11'], heart: ['#e93d82', ''],
      }
      const [col, d] = sym[v] ?? ['#888', '']
      if (v === 'heart') body = <path d="M8,14.5S1,10 1,5.5A3.5,3.5 0 0 1 8,4A3.5,3.5 0 0 1 15,5.5C15,10 8,14.5 8,14.5Z" fill={col} />
      else body = <><circle cx={8} cy={8} r={7.6} fill={col} />
        {d ? <path d={d} stroke="#fff" strokeWidth={1.9} fill="none" strokeLinecap="round" />
          : <text x={8} y={12.2} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">
            {v === 'question' ? '?' : v === 'exclam' ? '!' : 'i'}</text>}</>
      break
    }
    case 'arrow': {
      const rot: Record<string, number> = { up: 0, right: 90, down: 180, left: 270 }
      body = <><circle cx={8} cy={8} r={7.6} fill="#0090ff" />
        {v === 'refresh'
          ? <><path d="M11.6,6.2A4,4 0 1 0 12,9" stroke="#fff" strokeWidth={1.7} fill="none" /><path d="M12.6,3.6V6.8H9.4Z" fill="#fff" /></>
          : <path d="M8,3.5L12,8H9.6V12.5H6.4V8H4Z" fill="#fff" transform={`rotate(${rot[v]} 8 8)`} />}</>
      break
    }
    case 'person':
      body = <><circle cx={8} cy={5} r={3.4} fill={c} /><path d="M1.8,15.5Q2.4,9.4 8,9.4Q13.6,9.4 14.2,15.5Z" fill={c} /></>
      break
    case 'month':
    case 'week':
      body = <><rect x={0.8} y={1.5} width={14.4} height={13.7} rx={2.2} fill="#fff" stroke="#e5484d" strokeWidth={1.2} />
        <rect x={0.8} y={1.5} width={14.4} height={4.2} rx={1.6} fill="#e5484d" />
        <text x={8} y={13.4} textAnchor="middle" fontSize={g === 'month' ? 6.6 : 7} fontWeight={700} fill="#333" fontFamily="system-ui, sans-serif">
          {g === 'month' ? MONTHS[+v - 1] : WEEK[+v - 1]}</text></>
      break
    default:
      body = <circle cx={8} cy={8} r={7} fill="#ccc" />
  }
  return <g transform={`translate(${x},${y}) scale(${k})`} className="marker" data-marker={id}>{body}</g>
}

export const STICKERS = ['🎉', '🚀', '💡', '⭐', '🔥', '✅', '❌', '⚠️', '❓', '📌', '📎', '📅', '⏰', '📈', '📉', '💰',
  '🏆', '🎯', '🧠', '❤️', '👍', '👎', '👀', '🙂', '😎', '🤔', '😢', '😡', '☕', '🍀', '🌍', '🏠', '💻', '📱', '📚', '✏️',
  '🔒', '🔑', '🛠️', '⚙️', '🧪', '🎨', '🎵', '📷', '✈️', '🚗', '🐞', '🌟']
