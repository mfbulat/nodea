import { describe, expect, it } from 'vitest'
import { buildSlides } from '../editor/Presentation'
import type { Topic } from '../editor/model'

const t = (id: string, children: Topic[] = [], pitch?: Topic['pitch']): Topic => ({ id, title: id, children, pitch })

describe('презентация', () => {
  it('титул → обзор → ветки вглубь с крошками', () => {
    const root = t('C', [t('A', [t('a1'), t('a2')]), t('B')])
    const s = buildSlides(root).map(x => `${x.kind}:${x.topic.title}:${x.crumbs.join('/')}`)
    expect(s).toEqual(['title:C:', 'overview:C:', 'title:A:', 'overview:A:', 'title:a1:A', 'title:a2:A', 'title:B:'])
  })

  it('настройки темы: без слайда, без подслайдов, «все сразу»', () => {
    const root = t('C', [t('A', [t('a1')], { slide: 'no' }), t('B', [t('b1')], { subSlides: 'no' })], { delivery: 'all' })
    const s = buildSlides(root)
    expect(s.map(x => x.kind + ':' + x.topic.title)).toEqual(['title:C', 'overview:C'])
    expect(s[1].kind === 'overview' && s[1].reveal).toBe(false)
    const drill = buildSlides(t('C', [t('A', [t('a1')], { slide: 'no' }), t('B', [t('b1')], { subSlides: 'no' })]))
    expect(drill.map(x => x.kind + ':' + x.topic.title)).toEqual(['title:C', 'overview:C', 'overview:A', 'title:a1', 'title:B'])
  })
})
