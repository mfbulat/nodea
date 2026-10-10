// Собственный набор маркеров (рисуются примитивами SVG) и стикеров.
// В пределах группы маркеры взаимоисключающие, как в XMind.

export interface MarkerGroup { id: string; name: string; markers: string[] }

const COLORS: Record<string, string> = {
  red: '#ef5a5a', orange: '#f5964a', yellow: '#f5c443', green: '#58bd7d', blue: '#4f7cf6',
  purple: '#6c4fd9', gray: '#8e9399', pink: '#ec5b95', teal: '#12a594',
}
const PRIORITY = ['#ef5a5a', '#f5964a', '#f5c443', '#58bd7d', '#4f7cf6', '#6c4fd9', '#8e9399', '#8e4ec6', '#8b8d98']
const colorNames = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
/** символы веб-версии: цвет круга и белый знак (рисунки собственные) */
const SYMBOLS: Record<string, [string, string]> = {
  heart: ['red', 'Heart'], like: ['orange', 'Like'], dislike: ['blue', 'Dislike'], pin: ['red', 'Pin'],
  idea: ['yellow', 'Idea'], lightning: ['blue', 'Lightning'], hourglass: ['orange', 'Hourglass'], telephone: ['green', 'Phone'],
  pen: ['orange', 'Pen'], music: ['purple', 'Music'], entertainment: ['yellow', 'Entertainment'], 100: ['pink', 'Hundred'],
  flight: ['blue', 'Flight'], run: ['green', 'Run'], exclam: ['red', 'Important'], question: ['blue', 'Question'],
}

const SYMBOL_ORDER = ['heart', 'like', 'dislike', 'pin', 'idea', 'lightning', 'hourglass', 'telephone', 'pen', 'music', 'entertainment', '100', 'flight', 'run', 'exclam', 'question']

// панель показывает набор веб-версии; прочие маркеры (смайлы, стрелки, месяцы…) по-прежнему отображаются в темах
export const MARKER_GROUPS: MarkerGroup[] = [
  { id: 'tag', name: 'Tag', markers: colorNames.map(c => `tag-${c}`) },
  { id: 'priority', name: 'Priority', markers: [...Array(7).keys()].map(i => `priority-${i + 1}`) },
  { id: 'task', name: 'Task', markers: [0, 1, 3, 4, 5, 7, 8].map(i => `task-${i}`) },
  { id: 'flag', name: 'Flag', markers: colorNames.map(c => `flag-${c}`) },
  { id: 'star', name: 'Star', markers: colorNames.map(c => `star-${c}`) },
  { id: 'person', name: 'People', markers: colorNames.map(c => `person-${c}`) },
  { id: 'symbol', name: 'Symbol', markers: SYMBOL_ORDER.map(s => `symbol-${s}`) },
]

/** белые знаки символов в круге 16×16 */
const GLYPH: Record<string, JSX.Element> = {
  heart: <path d="M8,12.2S3.6,9.4 3.6,6.6A2.2,2.2 0 0 1 8,5.6A2.2,2.2 0 0 1 12.4,6.6C12.4,9.4 8,12.2 8,12.2Z" fill="#fff" />,
  like: <path d="M4,7.4h1.8v4.8H4zM6.6,7.4L8.4,4.2Q9.6,4 9.4,5.4L9.1,6.8h2.3q1,0 .8,1l-.7,3.2q-.2.9-1.1.9H6.6z" fill="#fff" />,
  dislike: <path d="M4,7.4h1.8v4.8H4zM6.6,7.4L8.4,4.2Q9.6,4 9.4,5.4L9.1,6.8h2.3q1,0 .8,1l-.7,3.2q-.2.9-1.1.9H6.6z" fill="#fff" transform="rotate(180 8 8)" />,
  pin: <><path d="M6.2,3.6h3.6l-.5,3 1.7,1.8H5l1.7-1.8z" fill="#fff" /><path d="M8,8.4v4.2" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" /></>,
  idea: <><path d="M8,3.4a3.2,3.2 0 0 1 1.9,5.8v1.4H6.1V9.2A3.2,3.2 0 0 1 8,3.4z" fill="#fff" /><path d="M6.6,11.8h2.8" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" /></>,
  lightning: <path d="M8.8,3.2L5,8.8h2.6L7,12.8l4-5.8H8.3z" fill="#fff" />,
  hourglass: <path d="M5.2,3.6h5.6M5.2,12.4h5.6M5.8,3.6Q5.8,6.6 8,8Q10.2,6.6 10.2,3.6M5.8,12.4Q5.8,9.4 8,8Q10.2,9.4 10.2,12.4" stroke="#fff" strokeWidth={1.2} fill="none" strokeLinecap="round" />,
  telephone: <path d="M5.4,3.8l1.5,-.3 .9,2.3-1,.8q.7,1.7 2.4,2.4l.8-1 2.3.9-.3,1.5q-.3,.9-1.3,.9Q6.6,11.1 4.5,5.1q0-1 .9-1.3z" fill="#fff" />,
  pen: <><path d="M10.4,3.8l1.8,1.8-5.8,5.8-2.4.6.6-2.4z" fill="#fff" /><path d="M9.4,4.8l1.8,1.8" stroke="currentColor" strokeWidth={0.6} /></>,
  music: <><path d="M7,10.6V4.6l4.4-1v5.8" stroke="#fff" strokeWidth={1.2} fill="none" /><circle cx={5.9} cy={10.8} r={1.4} fill="#fff" /><circle cx={10.3} cy={9.6} r={1.4} fill="#fff" /></>,
  entertainment: <><rect x={3.4} y={5.6} width={9.2} height={5.4} rx={2.4} fill="#fff" /><path d="M5.6,8.3h1.8M6.5,7.4v1.8" stroke="currentColor" strokeWidth={0.9} /><circle cx={10} cy={7.7} r={0.6} fill="currentColor" /><circle cx={10.9} cy={8.9} r={0.6} fill="currentColor" /></>,
  100: <text x={8} y={10.4} textAnchor="middle" fontSize={6.6} fontWeight={800} fill="#fff" fontFamily="system-ui, sans-serif">100</text>,
  flight: <path d="M8,3.2q.7,0 .7,1v2.6l3.8,2.2v1l-3.8-1.1v2.2l1,.8v.8L8,12.2 6.3,12.7v-.8l1-.8V8.9L3.5,10V9l3.8-2.2V4.2q0-1 .7-1z" fill="#fff" />,
  run: <><circle cx={9.6} cy={4.2} r={1.1} fill="#fff" /><path d="M5.2,7.2L7.4,5.8 9.4,6.4 10.2,8.2 11.6,8.6M8.6,6.2L7.6,9.2 9.4,10.6 8.8,12.6M7.6,9.2L6.4,11.2 4.6,11.4" stroke="#fff" strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const markerGroup = (id: string) => id.split('-')[0]

export function markerName(id: string): string {
  const [g, v] = id.split('-')
  switch (g) {
    case 'priority': return `Priority ${v}`
    case 'tag': return ({ red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple', gray: 'Gray' } as Record<string, string>)[v] ?? v
    case 'task': return +v === 0 ? 'Start' : +v === 8 ? 'Done' : `${+v}/8 Done`
    case 'flag': return 'Flag: ' + markerName('tag-' + v).toLowerCase()
    case 'star': return 'Star: ' + markerName('tag-' + v).toLowerCase()
    case 'person': return 'Person: ' + markerName('tag-' + v).toLowerCase()
    case 'symbol': return SYMBOLS[v]?.[1] ?? id
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
      const G = '#58bd7d'
      body = <><circle cx={8} cy={8} r={7.2} fill="#fff" stroke={G} strokeWidth={1.6} />
        {p >= 1 ? <circle cx={8} cy={8} r={8} fill={G} />
          : p > 0 ? <path d={`M8,8V2.6A5.4,5.4 0 ${big} 1 ${8 + 5.4 * Math.sin(a)},${8 - 5.4 * Math.cos(a)}Z`} fill={G} />
          : <path d="M6.6,5.2L11,8 6.6,10.8Z" fill={G} stroke={G} strokeWidth={0.8} strokeLinejoin="round" />}
        {p >= 1 && <path d="M4.6,8.3l2.3,2.3l4.4,-4.8" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />}</>
      break
    }
    case 'tag':
      body = <circle cx={8} cy={8} r={8} fill={c} />
      break
    case 'flag':
      body = <><circle cx={8} cy={8} r={8} fill={c} /><path d="M5.4,4.2V12.2" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" />
        <path d="M5.9,4.4H11.4L10,6.5 11.4,8.6H5.9Z" fill="#fff" /></>
      break
    case 'star':
      body = <><circle cx={8} cy={8} r={8} fill={c} /><path d="M8,3.4l1.4,2.9 3.1.4-2.3,2.2.6,3.1L8,10.5l-2.8,1.5.6-3.1L3.5,6.7l3.1-.4Z" fill="#fff" /></>
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
      if (SYMBOLS[v] && GLYPH[v] !== undefined || ['exclam', 'question'].includes(v) && SYMBOLS[v]) {
        const col = COLORS[SYMBOLS[v][0]]
        body = <g color={col}><circle cx={8} cy={8} r={8} fill={col} />
          {GLYPH[v] ?? <text x={8} y={12} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff" fontFamily="system-ui, sans-serif">{v === 'exclam' ? '!' : '?'}</text>}</g>
        break
      }
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
      body = <><circle cx={8} cy={8} r={8} fill={c} /><circle cx={8} cy={6.2} r={2.2} fill="#fff" /><path d="M4.2,12.2Q4.6,9.2 8,9.2Q11.4,9.2 11.8,12.2Z" fill="#fff" /></>
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

/** Стикеры по категориям, как в веб-версии (системные эмодзи) */
export const STICKER_CATEGORIES: { name: string; items: string[] }[] = [
  { name: 'Business', items: ['💵', '💼', '🧮', '💬', '☕', '📒', '🕐', '✉️', '🔍', '📁', '📽️', '📮', '📰', '📕', '📄', '🖨️', '📋', '📑', '🗒️', '🧾', '🖼️', '🔎', '🎯', '💲', '🎙️', '🪪', '✅', '🏅', '📊', '🧑‍💼', '👥', '📞', '📧', '📈', '📉', '📅', '🏆', '🗣️', '🧑‍🤝‍🧑', 'ℹ️', '❓', '🗑️', '🌐'] },
  { name: 'Education', items: ['🎓', '📚', '📖', '✏️', '🖊️', '📐', '📏', '🧪', '🔬', '🔭', '🧬', '🌍', '🧠', '🏫', '🎒', '📝', '🗂️', '📌', '📎', '✂️', '🖍️', '🧑‍🏫', '🧑‍🎓', '💡', '🔢', '🔤', '🧩', '🎨', '🎼', '🗺️'] },
  { name: 'Technology', items: ['💻', '🖥️', '⌨️', '🖱️', '📱', '⌚', '📷', '🎧', '🔋', '🔌', '💾', '💿', '📡', '🛰️', '🤖', '⚙️', '🛠️', '🔧', '🔩', '🧲', '🔒', '🔑', '🛡️', '☁️', '📶', '🕹️', '🎮', '🖨️', '🧑‍💻', '🚀'] },
  { name: 'Mood', items: ['😀', '😂', '🙂', '😉', '😍', '🤩', '😎', '🤔', '😐', '😴', '😮', '😢', '😭', '😡', '🤯', '🥳', '😇', '🤗', '🙄', '😬', '😷', '🤒', '😱', '🥰'] },
  { name: 'Travel', items: ['✈️', '🧳', '🗺️', '🧭', '🏖️', '🏝️', '⛰️', '🏕️', '🚗', '🚆', '🚢', '🚲', '🛵', '🚌', '🏨', '🗽', '🗼', '🏰', '🎡', '📸', '🎫', '🛂', '⛽', '🚦'] },
  { name: 'Holidays', items: ['🎉', '🎊', '🎂', '🎁', '🎈', '🎄', '🎃', '🎆', '🎇', '🕯️', '🥂', '🍾', '💝', '🌹', '🎀', '🪅'] },
  { name: 'Home', items: ['🏠', '🛋️', '🛏️', '🚿', '🧺', '🧹', '🧽', '🪴', '🕰️', '💡', '🔦', '🧴', '🪥', '👕', '👟', '👜', '🛒', '💊', '🧸', '🪑', '🚪', '🪟', '🧯', '🔨'] },
  { name: 'Animals', items: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦉', '🐢', '🐟', '🐬', '🦋', '🐝', '🐞'] },
  { name: 'Weather', items: ['☀️', '🌤️', '⛅', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '🌨️', '🌪️', '🌫️', '🌈', '🌙', '⭐', '🌡️', '☔'] },
  { name: 'Sports', items: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🏋️', '🚴', '🏊', '⛷️', '🏃', '🧘', '🏆'] },
  { name: 'Food & Drink', items: ['🍎', '🍌', '🍇', '🍓', '🍉', '🥑', '🥕', '🌽', '🍞', '🧀', '🥚', '🍕', '🍔', '🍟', '🌭', '🍣', '🍜', '🍰', '🍩', '🍪', '🍫', '☕', '🍵', '🥤', '🍺', '🍷'] },
  { name: 'Gestures', items: ['👍', '👎', '👌', '✌️', '🤞', '👏', '🙌', '🙏', '🤝', '👋', '✋', '👉', '👈', '☝️', '💪', '✍️'] },
  { name: 'Other', items: ['❤️', '⭐', '🔥', '⚡', '💯', '✅', '❌', '⚠️', '❗', '❓', '🔔', '📍', '🏁', '🚩', '♻️', '🆕'] },
]
export const STICKERS = STICKER_CATEGORIES.flatMap(c => c.items)
