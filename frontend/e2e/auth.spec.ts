import { expect, test } from '@playwright/test'

test('регистрация, создание карты из шаблона, выход и вход', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  await page.goto('/register')
  await page.getByPlaceholder('Почта').fill(email)
  await page.getByPlaceholder('Пароль (от 8 символов)').fill('password123')
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await expect(page.getByText('Мои карты')).toBeVisible()
  await page.getByRole('button', { name: '+ Новая карта' }).click()
  await page.locator('.tpl-card', { hasText: 'План проекта' }).click()
  await expect(page.locator('.topic', { hasText: 'Инициация' })).toBeVisible()
  await page.getByRole('link', { name: 'MindMap' }).click()
  await expect(page.getByTestId('map-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.getByPlaceholder('Почта').fill(email)
  await page.getByPlaceholder('Пароль').fill('password123')
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByTestId('map-card')).toHaveCount(1)
})
