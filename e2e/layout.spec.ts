import { expect, test, type Page } from '@playwright/test'

// Visible areas Safari leaves on common iPhones (upright and on their side).
const PHONES = [
  { name: '4-inch iPhone SE', width: 320, height: 568 },
  { name: 'iPhone SE', width: 375, height: 553 },
  { name: 'iPhone 13', width: 390, height: 664 },
  { name: 'iPhone SE on its side', width: 667, height: 325 },
  { name: 'iPhone 13 on its side', width: 844, height: 342 },
  { name: 'iPhone 15 Pro Max on its side', width: 932, height: 380 },
]

const overflow = (page: Page) =>
  page.evaluate(() => ({
    y: document.documentElement.scrollHeight - window.innerHeight,
    x: document.documentElement.scrollWidth - window.innerWidth,
  }))

async function open(page: Page, aimToFire: boolean) {
  await page.goto('./?difficulty=easy')
  await page.evaluate((aim) => {
    localStorage.clear()
    localStorage.setItem('battleship:settings:v1', JSON.stringify({ sound: false, aimToFire: aim }))
  }, aimToFire)
  await page.reload()
}

test.describe('phone layouts', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone only')

  for (const phone of PHONES) {
    for (const aimToFire of [false, true]) {
      test(`battle fits without scrolling: ${phone.name}${aimToFire ? ', aim on' : ''}`, async ({
        page,
      }) => {
        await page.setViewportSize(phone)
        await open(page, aimToFire)
        await page.getByRole('button', { name: 'Randomize' }).click()
        await page.getByRole('button', { name: 'Start battle' }).click()
        await expect(page.getByRole('grid', { name: 'Enemy waters' })).toBeVisible()
        if (aimToFire)
          await expect(page.getByRole('button', { name: 'Tap a square to aim' })).toBeInViewport({
            ratio: 1,
          })
        expect(await overflow(page)).toEqual({ x: 0, y: 0 })
      })
    }
  }

  test('setup on a short, narrow landscape screen leaves room for the controls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 667, height: 500 })
    await open(page, false)
    await expect(page.getByRole('grid', { name: 'Your fleet placement' })).toBeInViewport({
      ratio: 1,
    })
    expect((await overflow(page)).x).toBe(0)
  })

  for (const phone of PHONES.filter((p) => p.width > p.height)) {
    test(`setup board fits beside the controls: ${phone.name}`, async ({ page }) => {
      await page.setViewportSize(phone)
      await open(page, false)
      const board = page.getByRole('grid', { name: 'Your fleet placement' })
      await expect(board).toBeInViewport({ ratio: 1 })
      const boardBox = (await board.boundingBox())!
      const controls = (await page.getByRole('region', { name: 'Fleet controls' }).boundingBox())!
      expect(controls.x).toBeGreaterThanOrEqual(boardBox.x + boardBox.width)
      expect((await overflow(page)).x).toBe(0)

      // The board stays on screen while the controls column scrolls to Start battle.
      await page.getByRole('button', { name: 'Randomize' }).click()
      const start = page.getByRole('button', { name: 'Start battle' })
      await expect(start).toBeInViewport()
      await page.getByRole('radiogroup', { name: 'Enemy fleet color' }).scrollIntoViewIfNeeded()
      await expect(board).toBeInViewport({ ratio: 1 })
      await start.click()
      await expect(page.getByRole('grid', { name: 'Enemy waters' })).toBeVisible()
    })
  }
})
