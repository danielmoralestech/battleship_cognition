import { expect, test, type Locator, type Page } from '@playwright/test'

/** Must match TOUCH_LIFT_CELLS in SetupScreen: touch drags aim this many cells above the finger. */
const TOUCH_LIFT_CELLS = 1.25

const board = (page: Page) => page.getByRole('grid', { name: 'Your fleet placement' })
const cell = (page: Page, label: string) => board(page).locator(`[data-coord="${label}"]`)
const chip = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Ships' }).getByRole('button', { name: new RegExp(`^${name}`) })

async function expectShip(page: Page, labels: string[], ship: string | null) {
  for (const label of labels) {
    const name = ship ? new RegExp(`^${label}, ${ship}$`) : new RegExp(`^${label}$`)
    await expect(cell(page, label)).toHaveAccessibleName(name)
  }
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, pitch: box.width + 2 }
}

/** Real mouse drag: Playwright's mouse emits genuine pointer events. */
async function mouseDrag(page: Page, from: Locator, to: Locator) {
  const a = await center(from)
  const b = await center(to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await page.mouse.up()
}

/**
 * Playwright can tap but not drag a touchscreen, so this dispatches the touch
 * PointerEvents iOS Safari would send. `to` is the cell the ship should land on.
 */
async function touchDrag(page: Page, from: Locator, to: Locator | { x: number; y: number }) {
  const start = await center(from)
  const end =
    'x' in to ? to : await center(to).then((c) => ({ x: c.x, y: c.y + c.pitch * TOUCH_LIFT_CELLS }))
  await page.evaluate(
    ({ start, end }) => {
      const fire = (type: string, p: { x: number; y: number }) =>
        (document.elementFromPoint(p.x, p.y) ?? document.body).dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            clientX: p.x,
            clientY: p.y,
            bubbles: true,
            cancelable: true,
          }),
        )
      fire('pointerdown', start)
      for (let i = 1; i <= 10; i++)
        fire('pointermove', {
          x: start.x + ((end.x - start.x) * i) / 10,
          y: start.y + ((end.y - start.y) * i) / 10,
        })
      fire('pointerup', end)
    },
    { start, end },
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('./?difficulty=easy')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test.describe('touch placement', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch only')

  test('controls sit above the board and the board does not scroll the page', async ({ page }) => {
    const controls = (await page.getByRole('button', { name: 'Randomize' }).boundingBox())!
    const grid = (await board(page).boundingBox())!
    expect(controls.y + controls.height).toBeLessThan(grid.y)
    expect(await board(page).evaluate((el) => getComputedStyle(el).touchAction)).toBe('none')
    await expect(page.getByRole('button', { name: /Place 5 more/ })).toBeInViewport()
  })

  test('tap to place, tap to rotate, drag to move or remove', async ({ page }) => {
    await cell(page, 'E5').tap()
    await expectShip(page, ['E5', 'F5', 'I5'], 'carrier')

    await cell(page, 'E5').tap()
    await expectShip(page, ['E5', 'E7', 'E9'], 'carrier')
    await expectShip(page, ['F5'], null)

    await touchDrag(page, cell(page, 'E7'), cell(page, 'B3'))
    await expectShip(page, ['B1', 'B3', 'B5'], 'carrier')
    await expectShip(page, ['E5', 'E9'], null)

    await touchDrag(page, chip(page, 'Battleship'), cell(page, 'H2'))
    await expectShip(page, ['F2', 'I2'], 'battleship')

    const off = await center(page.getByRole('region', { name: 'Fleet controls' }))
    await touchDrag(page, cell(page, 'B3'), off)
    await expectShip(page, ['B1', 'B5'], null)
    await expect(page.getByRole('button', { name: 'Place 4 more' })).toBeVisible()
  })
})

test.describe('mouse placement', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only')

  test('drag from the tray, drag to move, click to rotate', async ({ page }) => {
    await mouseDrag(page, chip(page, 'Carrier'), cell(page, 'E5'))
    await expectShip(page, ['C5', 'G5'], 'carrier')

    await mouseDrag(page, cell(page, 'C5'), cell(page, 'A1'))
    await expectShip(page, ['A1', 'E1'], 'carrier')
    await expectShip(page, ['C5'], null)

    await cell(page, 'C1').click()
    await expectShip(page, ['C1', 'C5'], 'carrier')
    await expectShip(page, ['A1'], null)

    await cell(page, 'C3').click({ button: 'right' })
    await expectShip(page, ['A3', 'E3'], 'carrier')
  })

  test('ships are sprites and the placement preview is tinted by validity', async ({ page }) => {
    await cell(page, 'E5').hover()
    await expect(board(page).locator('[data-ship="carrier"][data-preview="valid"]')).toBeVisible()
    await cell(page, 'E5').click()
    await expect(board(page).locator('[data-ship="carrier"]:not([data-preview])')).toBeVisible()

    await cell(page, 'D5').hover()
    await expect(
      board(page).locator('[data-ship="battleship"][data-preview="invalid"]'),
    ).toBeVisible()
    await cell(page, 'A1').hover()
    await expect(
      board(page).locator('[data-ship="battleship"][data-preview="valid"]'),
    ).toBeVisible()
  })
})
