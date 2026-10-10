// «Видео презентации»: слайды режима презентации (тот же SlideView) по шагам рендерятся
// в скрытый контейнер, растрируются и записываются в WebM через MediaRecorder.
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { Sheet } from '../editor/model'
import { buildSlides, SlideView, stepsOf } from '../editor/Presentation'

export async function pitchToWebm(sheet: Sheet, onProgress?: (p: number) => void): Promise<Blob> {
  const { toCanvas } = await import('html-to-image')
  const W = 1280, H = 720, dark = (sheet.pitchTheme ?? 'dark') === 'dark'
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;`
  document.body.appendChild(host)
  const root = createRoot(host)
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = dark ? '#000' : '#fff'; ctx.fillRect(0, 0, W, H)
  const stream = canvas.captureStream(30)
  const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  const done = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })) })
  rec.start(250)
  try {
    const slides = buildSlides(sheet.rootTopic)
    const frames = slides.flatMap(s => Array.from({ length: stepsOf(s) + 1 }, (_, step) => ({ s, step })))
    for (let i = 0; i < frames.length; i++) {
      const { s, step } = frames[i]
      flushSync(() => root.render(
        <div className={'pitch ' + (dark ? 'dark' : 'light')} style={{ position: 'relative', width: W, height: H, inset: 'auto' }}>
          <div className="pitch-stage" style={{ width: W, height: H }}><SlideView slide={s} step={step} W={W} H={H} anim={false} /></div>
        </div>))
      const frame = await toCanvas(host.firstElementChild as HTMLElement, { width: W, height: H, pixelRatio: 1, backgroundColor: dark ? '#000' : '#fff' })
      ctx.drawImage(frame, 0, 0, W, H)
      onProgress?.((i + 1) / frames.length)
      // каждый шаг держим на экране ~2 секунды (заголовки — 2.5)
      await new Promise(r => setTimeout(r, step === 0 && s.kind === 'title' ? 2500 : 2000))
    }
  } finally {
    rec.stop()
    root.unmount()
    host.remove()
  }
  return done
}
