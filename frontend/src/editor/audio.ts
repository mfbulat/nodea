// Аудиозаметка: запись с микрофона (MediaRecorder) и загрузка в хранилище файлов.
import { uploadFile } from './actions'
import { useEditor } from './store'

export async function recordAudio(id: string) {
  let stream: MediaStream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {
    alert('Нет доступа к микрофону. Разрешите его в настройках браузера.')
    return
  }
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.ondataavailable = e => chunks.push(e.data)
  const started = Date.now()
  // простое окно записи поверх редактора
  const box = document.createElement('div')
  box.className = 'rec-box'
  box.innerHTML = '<span class="rec-dot"></span><span class="rec-time">0:00</span><button class="rec-stop">Остановить</button><button class="rec-cancel">Отмена</button>'
  document.body.appendChild(box)
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000)
    box.querySelector('.rec-time')!.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }, 500)
  let cancelled = false
  const done = new Promise<void>(resolve => { rec.onstop = () => resolve() })
  box.querySelector('.rec-stop')!.addEventListener('click', () => rec.stop())
  box.querySelector('.rec-cancel')!.addEventListener('click', () => { cancelled = true; rec.stop() })
  rec.start()
  await done
  clearInterval(timer)
  stream.getTracks().forEach(t => t.stop())
  box.remove()
  if (cancelled || !chunks.length) return
  const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
  try {
    const up = await uploadFile(new File([blob], 'audio.webm', { type: blob.type }))
    useEditor.getState().setTopic([id], { audio: { url: up.url, duration: Math.round((Date.now() - started) / 1000) } })
  } catch (e) { alert('Не удалось сохранить запись: ' + (e as Error).message) }
}
