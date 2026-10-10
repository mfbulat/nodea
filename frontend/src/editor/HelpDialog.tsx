// Справка по сочетаниям клавиш
export const SHORTCUTS: [string, string][] = [
  ['Tab', 'Subtopic'], ['Enter', 'Topic after'], ['Shift+Enter', 'Topic before'],
  ['Delete / Backspace', 'Delete'], ['F2 / Space / type a character', 'Edit text'],
  ['Arrow keys', 'Navigate (Shift extends the selection)'], ['Ctrl+/', 'Fold / Unfold'],
  ['Ctrl+Z / Ctrl+Shift+Z, Ctrl+Y', 'Undo / Redo'], ['Ctrl+C / X / V', 'Copy / Cut / Paste'],
  ['Ctrl+Alt+C / V', 'Copy / Paste Style'], ['Ctrl+A', 'Select All'],
  ['Ctrl+= / Ctrl+-', 'Zoom'], ['Ctrl+0 / Ctrl+Shift+0', 'Fit Map / Actual Size'],
  ['Ctrl/Shift+click, drag a selection box', 'Multiple selection'], ['Space+drag, right button, wheel', 'Pan'],
  ['Ctrl+wheel', 'Zoom'], ['Ctrl+L / Ctrl+B / Ctrl+]', 'Relationship / Boundary / Summary'], ['Ctrl+K', 'Link'],
  ['Ctrl+Shift+N', 'Note'], ['Drop a file on a topic', 'Image or attachment'],
  ['Double-click a relationship/boundary', 'Label'], ['Double-click empty space', 'Floating Topic'], ['Home', 'Go to Central Topic'],
]

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-bg" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose() }}>
      <div className="modal help" role="dialog" aria-label="Shortcuts">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Shortcuts</h3><div className="spacer" />
          <button className="ibtn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <table><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}
