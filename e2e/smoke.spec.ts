import { expect, test } from '@playwright/test'

test('place a fleet, play a full game and see the result', async ({ page }) => {
  await page.goto('./?difficulty=easy')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()

  const enemy = page.getByRole('grid', { name: 'Enemy waters' })
  const dialog = page.getByRole('dialog')
  for (let i = 0; i < 100 && !(await dialog.isVisible()); i++) {
    const open = enemy.locator('button:not([disabled])')
    await expect(open.first().or(dialog)).toBeVisible()
    if (await dialog.isVisible()) break
    await open.first().click()
  }

  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading')).toHaveText(/Victory!|Defeat/)
  await dialog.getByRole('button', { name: 'Rematch' }).click()
  await expect(page.getByRole('button', { name: 'Start battle' })).toBeEnabled()
})
