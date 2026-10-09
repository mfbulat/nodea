import { api } from '../api/client'
import { canvasApi } from './MapCanvas'
import { useEditor } from './store'

interface Uploaded { url: string; name: string; size: number; contentType: string | null }

export async function uploadFile(file: File): Promise<Uploaded> {
  const fd = new FormData()
  fd.append('file', file)
  return api<Uploaded>('/api/files', { method: 'POST', body: fd })
}

export function pickFile(accept?: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 160, height: 120 })
    img.src = src
  })
}

/** Изображение — в картинку темы (ширина до 240px), прочие файлы — во вложение */
export async function uploadToTopic(id: string, file: File, as?: 'image' | 'attachment') {
  const kind = as ?? (file.type.startsWith('image/') ? 'image' : 'attachment')
  try {
    const up = await uploadFile(file)
    if (kind === 'image') {
      const { width, height } = await imageSize(up.url)
      const k = Math.min(1, 240 / width)
      useEditor.getState().setTopic([id], { image: { src: up.url, width: Math.round(width * k), height: Math.round(height * k) } })
    } else {
      useEditor.getState().setTopic([id], { attachment: { url: up.url, name: up.name, size: up.size } })
    }
  } catch (e) {
    alert('Не удалось загрузить файл: ' + (e as Error).message)
  }
}

export function followLink(href: string) {
  if (href.startsWith('topic:')) {
    const id = href.slice(6)
    if (useEditor.getState().revealTopic(id)) setTimeout(() => canvasApi.center(id), 50)
    else alert('Тема, на которую указывает ссылка, не найдена')
  } else {
    window.open(/^[a-z]+:/i.test(href) ? href : 'https://' + href, '_blank', 'noopener')
  }
}
