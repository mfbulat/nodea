import { expect, test } from '@playwright/test'

test('регистрация, создание карты из шаблона, выход и вход', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  await page.goto('/register')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password (8+ characters)').fill('password123')
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(page.getByRole('heading', { name: 'Recents' })).toBeVisible()
  await page.getByRole('button', { name: 'Create New' }).click()
  await page.getByRole('button', { name: /Mind Map/ }).click()
  await page.locator('.tpl-card', { hasText: 'Project Plan' }).click()
  await expect(page.locator('.topic', { hasText: 'Initiation' })).toBeVisible()
  await page.getByRole('link', { name: 'My Works' }).click()
  await expect(page.getByTestId('map-card')).toHaveCount(1)
  await page.locator('.user-btn').click()
  await page.getByRole('menuitem', { name: 'Log Out' }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('password123')
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page.getByTestId('map-card')).toHaveCount(1)
})
