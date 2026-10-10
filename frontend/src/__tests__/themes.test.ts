import { describe, expect, it } from 'vitest'
import { resolveStyle, sheetBackground, textOn } from '../editor/themes'
import { indexSheet, type Sheet } from '../editor/model'

const sheet = (palette?: string, rainbow?: boolean): Sheet => ({
  id: 's', title: 'Лист', theme: 'classic', palette, rainbow,
  rootTopic: { id: 'r', title: 'Центр', children: [{ id: 'a', title: 'A', children: [{ id: 'a1', title: 'A1' }] }, { id: 'b', title: 'B' }] },
} as Sheet)
const style = (sh: Sheet, id: string) => resolveStyle(sh, indexSheet(sh).get(id)!)

describe('цветовые темы как в веб-версии', () => {
  it('Ирис: центральная, заливки и текст основных тем', () => {
    const sh = sheet('iris')
    expect(sheetBackground(sh)).toBe('#ffffff')
    expect(style(sh, 'r').textColor).toBe('#2e0f6b')
    expect(style(sh, 'a')).toMatchObject({ fill: '#9257ff', textColor: '#ffffff', lineColor: '#9257ff' })
    expect(style(sh, 'b')).toMatchObject({ fill: '#9d02ea', textColor: '#ffffff' })
  })
  it('Космос: тёмный фон; классическая тема без цветных веток', () => {
    expect(sheetBackground(sheet('space'))).toBe('#0d2f42')
    const fl = sheet('flowers')
    expect(style(fl, 'a')).toMatchObject({ fill: '#d02f48', textColor: '#ffffff', lineColor: '#4a1019' })
    expect(style(fl, 'r').textColor).toBe('#a61d39')
  })
  it('порог текста на заливке', () => {
    expect(textOn('#5ba683')).toBe('#000000')
    expect(textOn('#4b9383')).toBe('#ffffff')
    expect(textOn('#b67be6')).toBe('#ffffff')
  })
})
