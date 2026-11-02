import { devices, expect, test, type Page } from '@playwright/test'

const enemy = (page: Page) => page.getByRole('grid', { name: 'Enemy waters' })

async function startBattle(page: Page) {
  await page.goto('./?difficulty=easy')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
  await expect(enemy(page)).toBeVisible()
}

async function fireOnce(page: Page, label = 'E5') {
  await enemy(page).locator(`[data-coord="${label}"]`).click()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()
}

const fitsViewport = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)

test.describe('phone portrait', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone only')

  test('enemy board and fleet mini-map fit on screen', async ({ page }) => {
    await startBattle(page)
    const cell = (await enemy(page).locator('button').first().boundingBox())!
    expect(cell.width).toBeGreaterThanOrEqual(24)
    await expect(page.getByRole('button', { name: 'Show your fleet' })).toBeInViewport()
    expect(await fitsViewport(page)).toBe(true)

    await enemy(page).locator('[data-coord="E5"]').tap()
    await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()

    await page.getByRole('button', { name: 'Show your fleet' }).tap()
    const sheet = page.getByRole('dialog', { name: 'Your fleet' })
    await expect(sheet.getByRole('grid', { name: 'Your fleet' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Close' }).tap()
    await expect(sheet).toBeHidden()
  })

  test('restart lives in the menu and asks for confirmation', async ({ page }) => {
    await startBattle(page)
    await expect(page.getByRole('button', { name: 'Restart' })).toBeHidden()
    await fireOnce(page)

    const menu = page.getByRole('button', { name: 'Game menu' })
    const confirm = page.getByRole('alertdialog', { name: 'Abandon this battle?' })
    await menu.tap()
    await page.getByRole('menuitem', { name: 'Restart' }).tap()
    await confirm.getByRole('button', { name: 'Cancel' }).tap()
    await expect(confirm).toBeHidden()
    await expect(enemy(page)).toBeVisible()

    await menu.tap()
    await page.getByRole('menuitem', { name: 'Restart' }).tap()
    await confirm.getByRole('button', { name: 'Restart' }).tap()
    await expect(page.getByRole('button', { name: 'Start battle' })).toBeEnabled()
  })
})

test.describe('phone landscape', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone only')
  test.use({ viewport: devices['iPhone 13 landscape'].viewport })

  test('both boards sit side by side without scrolling', async ({ page }) => {
    await startBattle(page)
    const mine = page.getByRole('grid', { name: 'Your fleet' })
    await expect(enemy(page)).toBeInViewport({ ratio: 1 })
    await expect(mine).toBeInViewport({ ratio: 1 })
    const a = (await enemy(page).boundingBox())!
    const b = (await mine.boundingBox())!
    expect(a.x + a.width).toBeLessThan(b.x)
  })
})

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only')

  test('both boards are shown and restart is confirmed mid-battle', async ({ page }) => {
    await startBattle(page)
    await expect(page.getByRole('grid', { name: 'Your fleet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Game menu' })).toBeHidden()
    await fireOnce(page)

    await page.getByRole('button', { name: 'New fleet' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Abandon this battle?' })
    await confirm.getByRole('button', { name: 'New fleet' }).click()
    await expect(page.getByRole('button', { name: 'Place 5 more' })).toBeVisible()
  })
})
