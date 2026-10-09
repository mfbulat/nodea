import { expect, type Page } from '@playwright/test'

export async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const r = await page.request.post('/api/auth/register', { data: { email, password: 'password123' } })
  expect(r.ok()).toBeTruthy()
  return email
}

export async function newMap(page: Page, document?: object, title = 'Центральная тема') {
  const doc = document ?? { version: 1, sheets: [{ id: 's', title: 'Карта 1', rootTopic: { id: 'r', title, children: [] } }] }
  const r = await page.request.post('/api/maps', { data: { title, document: doc } })
  const m = await r.json()
  await page.goto(`/map/${m.id}`)
  await expect(page.getByTestId('map-canvas')).toBeVisible()
  return m.id as string
}

export const topic = (page: Page, title: string) => page.locator('.topic', { hasText: title }).first()

export async function docOf(page: Page, id: string) {
  return (await (await page.request.get(`/api/maps/${id}`)).json()).document
}

/** Документ сохраняет сервер комнаты (раз в секунду) — ждём, пока в базе появится ожидаемое дерево */
export async function expectTree(page: Page, id: string, expected: string) {
  await expect.poll(async () => titles((await docOf(page, id)).sheets[0].rootTopic), { timeout: 10_000 }).toBe(expected)
}

export const titles = (t: { title: string; children?: unknown[] }): string =>
  t.title + (t.children?.length ? '[' + (t.children as typeof t[]).map(titles).join(',') + ']' : '')
