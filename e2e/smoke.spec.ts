import { expect, test } from '@playwright/test'

// A ~50-shot game; animated battle effects make headless WebKit too slow for it. effects.spec.ts covers them.
test.use({ reducedMotion: 'reduce' })

test('place a fleet, play a full game and see the result', async ({ page }) => {
  // ~50 turns at full shot timing take ~30s locally and can pass 60s on a slow CI runner.
  test.slow()
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
  const won = (await dialog.getByRole('heading').textContent()) === 'Victory!'
  await expect
    .poll(() => page.evaluate(() => window.__sounds ?? []))
    .toContain(won ? 'victory' : 'defeat')
  await dialog.getByRole('button', { name: 'Rematch' }).click()
  await expect(page.getByRole('button', { name: 'Start battle' })).toBeEnabled()
})
