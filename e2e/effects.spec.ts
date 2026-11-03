import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./?difficulty=easy')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
})

test('battle effects play without blocking taps', async ({ page }) => {
  const enemy = page.getByRole('grid', { name: 'Enemy waters', exact: true })
  const board = enemy.locator('xpath=..')
  await expect(board.locator('[data-fx="radar-scan"]')).toBeAttached()
  await expect(board.locator('canvas')).toBeAttached()

  for (let i = 0; i < 40 && (await enemy.locator('[data-fx="fire"]').count()) === 0; i++) {
    await enemy.locator('button:not([disabled])').first().click()
  }
  await expect(enemy.locator('[data-fx="fire"]').first()).toBeVisible()
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('hides the radar sweep', async ({ page }) => {
    const board = page.getByRole('grid', { name: 'Enemy waters', exact: true }).locator('xpath=..')
    await expect(board.locator('[data-fx="radar-scan"]')).toBeHidden()
  })
})
