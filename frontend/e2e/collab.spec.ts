import { expect, test, type Browser, type Page } from '@playwright/test'
import { newMap, signUp, titles, topic } from './helpers'

const DOC = { version: 1, sheets: [{ id: 's', title: 'Л', rootTopic: { id: 'r', title: 'Общая карта', children: [
  { id: 'a', title: 'Первая', children: [] }, { id: 'b', title: 'Вторая', children: [] }] } }] }

async function shareLink(page: Page, mapId: string, role: 'view' | 'edit') {
  const s = await (await page.request.post(`/api/maps/${mapId}/shares`, { data: { role } })).json()
  return `/s/${s.token}`
}

async function guest(browser: Browser, url: string) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(url)
  await expect(page.getByTestId('map-canvas')).toBeVisible()
  return page
}

async function rename(page: Page, from: string, to: string) {
  await topic(page, from).dblclick()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(to)
  await page.keyboard.press('Enter')
}

test('правки по ссылке доходят в обе стороны, курсоры и участники видны', async ({ page, browser }) => {
  await signUp(page)
  const id = await newMap(page, DOC)
  const g = await guest(browser, await shareLink(page, id, 'edit'))
  await expect(g.getByText(/editing via link/i)).toBeVisible()

  await rename(page, 'Первая', 'От владельца')
  await expect(topic(g, 'От владельца')).toBeVisible()

  await topic(g, 'Вторая').click()
  await g.keyboard.press('Tab')
  await g.keyboard.type('От гостя')
  await g.keyboard.press('Enter')
  await expect(topic(page, 'От гостя')).toBeVisible()

  // участники и курсор гостя у владельца
  await expect(page.getByTestId('presence').locator('span[data-peer]')).toHaveCount(1)
  await g.mouse.move(300, 400)
  await g.mouse.move(320, 420)
  await expect(page.getByTestId('peer-cursor')).toBeVisible()

  // отмена у владельца откатывает только его правку
  await page.getByTestId('map-canvas').click({ position: { x: 10, y: 10 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect(topic(g, 'Первая')).toBeVisible()
  await expect(topic(g, 'От гостя')).toBeVisible()

  // после ухода всех документ сохранён на сервере
  await g.context().close()
  await page.goto('/')
  await expect.poll(async () => titles((await (await page.request.get(`/api/maps/${id}`)).json()).document.sheets[0].rootTopic))
    .toBe('Общая карта[Первая,Вторая[От гостя]]')
})

test('одновременные правки разных тем не теряются', async ({ page, browser }) => {
  await signUp(page)
  const id = await newMap(page, DOC)
  const g = await guest(browser, await shareLink(page, id, 'edit'))
  await Promise.all([rename(page, 'Первая', 'П1'), rename(g, 'Вторая', 'В2')])
  for (const p of [page, g]) {
    await expect(topic(p, 'П1')).toBeVisible()
    await expect(topic(p, 'В2')).toBeVisible()
  }
})

test('ссылка для просмотра: правки недоступны, изменения владельца видны', async ({ page, browser }) => {
  await signUp(page)
  const id = await newMap(page, DOC)
  const v = await guest(browser, await shareLink(page, id, 'view'))
  await expect(v.getByTestId('save-state').getByText(/view only/i)).toBeVisible()
  await expect(v.locator('.bar-center')).toHaveCount(0)
  await topic(v, 'Первая').click()
  await v.keyboard.press('Tab')
  await topic(v, 'Первая').dblclick()
  await expect(v.locator('.title-editor')).toHaveCount(0)
  await rename(page, 'Вторая', 'Видно зрителю')
  await expect(topic(v, 'Видно зрителю')).toBeVisible()
  expect(await v.locator('.topic').count()).toBe(3)
})

test('отозванная ссылка не открывается', async ({ page, browser }) => {
  await signUp(page)
  const id = await newMap(page, DOC)
  const s = await (await page.request.post(`/api/maps/${id}/shares`, { data: { role: 'edit' } })).json()
  await page.request.delete(`/api/maps/${id}/shares/${s.id}`)
  const ctx = await browser.newContext()
  const g = await ctx.newPage()
  await g.goto(`/s/${s.token}`)
  await expect(g.getByText('The link is invalid or has been revoked')).toBeVisible()
})

test('откат версии применяется у всех участников', async ({ page, browser }) => {
  await signUp(page)
  const id = await newMap(page, DOC)
  const g = await guest(browser, await shareLink(page, id, 'edit'))
  await rename(g, 'Первая', 'Испорчено')
  await expect(topic(page, 'Испорчено')).toBeVisible()
  const versions = await (await page.request.get(`/api/maps/${id}/versions`)).json()
  await page.request.post(`/api/maps/${id}/versions/${versions[versions.length - 1].id}/restore`)
  await expect(topic(g, 'Первая')).toBeVisible()
  await expect(topic(page, 'Первая')).toBeVisible()
})
