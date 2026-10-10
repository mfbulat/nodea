// TextBundle (.textpack): Markdown-текст карты и файлы изображений/вложений в папке assets.
import type { MapDocument } from '../editor/model'
import { indexSheet } from '../editor/model'
import { toMarkdown } from './text'

export async function toTextBundle(doc: MapDocument): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const root = zip.folder('map.textbundle')!
  const assets = root.folder('assets')!
  let md = toMarkdown(doc)
  const extra: string[] = []
  let n = 0
  for (const sh of doc.sheets) for (const r of indexSheet(sh).values()) {
    const t = r.topic
    const files: { url: string; name: string; image: boolean }[] = []
    if (t.image && !t.image.src.startsWith('emoji:')) files.push({ url: t.image.src, name: `image-${++n}`, image: true })
    if (t.attachment) files.push({ url: t.attachment.url, name: t.attachment.name || `file-${++n}`, image: false })
    for (const f of files) {
      try {
        const blob = await (await fetch(f.url)).blob()
        const ext = f.image ? '.' + ((blob.type.split('/')[1] ?? 'png').replace('svg+xml', 'svg')) : ''
        const name = f.name.replace(/[\\/:*?"<>|]/g, '_') + (f.image && !/\.\w+$/.test(f.name) ? ext : '')
        assets.file(name, blob)
        extra.push(f.image ? `![${t.title}](assets/${encodeURI(name)})` : `[${name}](assets/${encodeURI(name)}) — ${t.title}`)
      } catch { /* недоступный файл пропускаем */ }
    }
  }
  if (extra.length) md += '\n\n## Ресурсы\n\n' + extra.join('\n\n') + '\n'
  root.file('text.markdown', md)
  root.file('info.json', JSON.stringify({ version: 2, type: 'net.daringfireball.markdown', transient: false, creatorIdentifier: 'mindmap' }))
  return zip.generateAsync({ type: 'blob' })
}
