// Собственный набор линейных иконок 20×20 (stroke = currentColor).
const P: Record<string, JSX.Element> = {
  home: <path d="M3.5 9.5L10 4l6.5 5.5M5.5 8v8h9V8" />,
  undo: <path d="M7 5L3.5 8.5 7 12M4 8.5h7.5a4 4 0 010 8H9" />,
  redo: <path d="M13 5l3.5 3.5L13 12M16 8.5H8.5a4 4 0 000 8H11" />,
  topic: <><rect x="3" y="6" width="14" height="8" rx="2.5" /></>,
  subtopic: <><rect x="2.5" y="7.5" width="7" height="5" rx="1.5" /><path d="M9.5 10h2.5v-4h5M12 10v4h5" /></>,
  relationship: <><path d="M4 15C4 7 12 4 16 7" strokeDasharray="2.2 2" /><path d="M13.5 5.2L16.3 7l-2.2 2.4" /></>,
  summary: <><path d="M4 4.5h2a1.5 1.5 0 011.5 1.5v2.5L9 10l-1.5 1.5V14A1.5 1.5 0 016 15.5H4" /><rect x="11" y="8" width="6" height="4" rx="1" /></>,
  boundary: <rect x="3" y="4.5" width="14" height="11" rx="3" strokeDasharray="2.4 2" />,
  note: <><rect x="4" y="3.5" width="12" height="13" rx="2" /><path d="M7 7.5h6M7 10h6M7 12.5h4" /></>,
  label: <><path d="M3.5 10.2V4.5a1 1 0 011-1h5.7l6.3 6.3-6.7 6.7z" /><circle cx="7" cy="7" r="1.1" /></>,
  task: <><rect x="3.5" y="3.5" width="13" height="13" rx="2.5" /><path d="M7 10.2l2.2 2.2L13.5 8" /></>,
  plus: <path d="M10 4v12M4 10h12" />,
  chevron: <path d="M6 8l4 4 4-4" />,
  share: <><path d="M10 12.5V3.5M6.5 7L10 3.5 13.5 7" /><path d="M5 10.5v5h10v-5" /></>,
  marker: <><circle cx="10" cy="10" r="6.5" /><path d="M7.5 11.5a3 3 0 005 0" /><circle cx="8" cy="8.5" r=".6" /><circle cx="12" cy="8.5" r=".6" /></>,
  panel: <><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M12 4v12" /></>,
  more: <><circle cx="5" cy="10" r="1" /><circle cx="10" cy="10" r="1" /><circle cx="15" cy="10" r="1" /></>,
  outline: <path d="M4 5.5h1.5M8 5.5h8M4 10h1.5M8 10h8M4 14.5h1.5M8 14.5h8" />,
  map: <><rect x="7.5" y="8" width="5" height="4" rx="1" /><path d="M7.5 10H4M12.5 10H16M4 6v8M16 6v8" /></>,
  zen: <path d="M4 7.5V4h3.5M12.5 4H16v3.5M16 12.5V16h-3.5M7.5 16H4v-3.5" />,
  present: <><rect x="3" y="4" width="14" height="9.5" rx="1.5" /><path d="M10 13.5V16M7 16h6M8.7 6.8l3.3 2-3.3 2z" /></>,
  search: <><circle cx="9" cy="9" r="5" /><path d="M13 13l3.5 3.5" /></>,
  filter: <path d="M3.5 5h13l-5 6v4.5l-3-1.5v-3z" />,
  branch: <><rect x="3" y="8" width="5" height="4" rx="1" /><path d="M8 10h3M11 6v8M11 6h2M11 14h2" /><rect x="13" y="4.5" width="4" height="3" rx=".8" /><rect x="13" y="12.5" width="4" height="3" rx=".8" /></>,
  history: <><path d="M4 10a6 6 0 106-6 6 6 0 00-4.5 2M4 3.5V6.5h3" /><path d="M10 7v3.5l2.5 1.5" /></>,
  keyboard: <><rect x="2.5" y="5.5" width="15" height="9" rx="1.5" /><path d="M5.5 8.5h.01M8.5 8.5h.01M11.5 8.5h.01M14.5 8.5h.01M7 11.5h6" /></>,
  comment: <path d="M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v6a1.5 1.5 0 01-1.5 1.5H9L6 16v-3h-.5A1.5 1.5 0 014 11.5z" />,
  file: <><path d="M5 3.5h6.5L15 7v9.5H5z" /><path d="M11.5 3.5V7H15" /></>,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  floating: <><rect x="3" y="7" width="9" height="6" rx="2" /><path d="M14 5h3M15.5 3.5v3" /></>,
  collapse: <><circle cx="10" cy="10" r="6.5" /><path d="M7 10h6" /></>,
  trash: <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.8 10h6.4L14 6" />,
  star: <path d="M10 3.5l2 4.2 4.5.6-3.3 3.1.8 4.5-4-2.2-4 2.2.8-4.5-3.3-3.1 4.5-.6z" />,
  folder: <path d="M3 6a1.5 1.5 0 011.5-1.5h3.2l1.6 1.7h6.2A1.5 1.5 0 0117 7.7v7A1.5 1.5 0 0115.5 16.2h-11A1.5 1.5 0 013 14.7z" />,
  clock: <><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.5 1.5" /></>,
  users: <><circle cx="8" cy="7.5" r="2.5" /><path d="M3.5 15.5a4.5 4.5 0 019 0M13 5.5a2.3 2.3 0 010 4.4M14.5 15.5a4 4 0 00-1.8-3.4" /></>,
  template: <><rect x="3" y="3.5" width="14" height="13" rx="2" /><path d="M3 8h14M8 8v8.5" /></>,
  upload: <><path d="M10 13V4M6.5 7.5L10 4l3.5 3.5" /><path d="M4 13v3h12v-3" /></>,
  link: <path d="M8.5 11.5l3-3M9 6l1.4-1.4a3 3 0 014.2 4.2L13.2 10.2M11 14l-1.4 1.4a3 3 0 01-4.2-4.2L6.8 9.8" />,
  image: <><rect x="3" y="4" width="14" height="12" rx="2" /><circle cx="7.5" cy="8" r="1.3" /><path d="M3.5 14l4-4 3 3 2-2 4 4" /></>,
  brush: <><path d="M12.5 3.5l4 4-6 6-4-4z" /><path d="M6.5 9.5l-2.6 2.6a2 2 0 000 2.8l1.2 1.2a2 2 0 002.8 0l2.6-2.6" /></>,
  gantt: <><path d="M3.5 4v12.5H17" /><path d="M6 6.5h5M8 9.5h6M7 12.5h4" strokeWidth={2.2} /></>,
  mic: <><rect x="7.5" y="3" width="5" height="9" rx="2.5" /><path d="M5 9.5a5 5 0 0010 0M10 14.5V17" /></>,
  print: <><path d="M6 7V3.5h8V7" /><rect x="3.5" y="7" width="13" height="6.5" rx="1.5" /><path d="M6 11.5h8v5H6z" /></>,
  camera: <><rect x="3" y="5.5" width="14" height="10.5" rx="2" /><path d="M7 5.5l1.2-2h3.6l1.2 2" /><circle cx="10" cy="10.5" r="2.8" /></>,
  indent: <path d="M4 5h12M8 8.5h8M8 12h8M4 15.5h12M4 8.5l2.2 1.75L4 12" />,
  outdent: <path d="M4 5h12M8 8.5h8M8 12h8M4 15.5h12M6.2 8.5L4 10.25 6.2 12" />,
  nav: <><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M8 4v12M4.8 7.5h1.5M4.8 10h1.5M4.8 12.5h1.5" /></>,
  grid: <><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="11" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="3.5" y="11" width="5.5" height="5.5" rx="1" /><rect x="11" y="11" width="5.5" height="5.5" rx="1" /></>,
  list: <path d="M4 5.5h12M4 10h12M4 14.5h12" />,
  sort: <path d="M7 4v12M4 7l3-3 3 3M13 16V4M10 13l3 3 3-3" />,
  bell: <><path d="M5.5 13.5V9a4.5 4.5 0 019 0v4.5l1.5 1.5H4z" /><path d="M8.5 16.5a1.5 1.5 0 003 0" /></>,
  bulb: <><path d="M7.5 13.5a5 5 0 115 0V15h-5z" /><path d="M8 17h4" /></>,
  mindmap: <><path d="M7.5 10h5M7.5 10C5.5 10 5 6 3 6M7.5 10C5.5 10 5 14 3 14M12.5 10c2 0 2.5-4 4.5-4M12.5 10c2 0 2.5 4 4.5 4" /></>,
  importFile: <><path d="M10 3.5v9M6.5 9L10 12.5 13.5 9" /><path d="M4 12.5v4h12v-4" /></>,
  restore: <path d="M4 10a6 6 0 106-6 6 6 0 00-4.5 2M4 3.5V6.5h3" />,
  chevronRight: <path d="M8 5l5 5-5 5" />,
  hamburger: <path d="M4 6h12M4 10h12M4 14h12" />,
  settings: <><circle cx="10" cy="10" r="2.5" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M5 15l1.4-1.4M13.6 6.4L15 5" /></>,
}

export type IconName = keyof typeof P

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icon">
      {P[name]}
    </svg>
  )
}
