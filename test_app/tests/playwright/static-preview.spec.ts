import { test, expect } from '@playwright/test'
import path from 'path'

test('web entry redirects to admin by default', async ({ page }) => {
  const filePath = path.resolve(__dirname, '../../apps/web/index.html')

  await page.goto(`file://${filePath}?noRedirect=1`)

  await expect(page.locator('h1')).toHaveText('Opening Payload Admin...')
  await expect(page.locator('a')).toHaveAttribute('href', 'http://localhost:3000/admin')
})
