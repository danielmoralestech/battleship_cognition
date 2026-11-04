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

  test('the mouse wheel rotates the preview, a placed ship and a dragged ship', async ({
    page,
  }) => {
    const rotate = page.getByRole('button', { name: /^Rotate/ })
    const wheelAt = async (target: Locator) => {
      const c = await center(target)
      await page.mouse.move(c.x, c.y)
      await page.mouse.wheel(0, 100)
    }
    await wheelAt(cell(page, 'E5'))
    await expect(rotate).toHaveAccessibleName('Rotate (facing south)')
    // A burst of deltas (one trackpad swipe) only turns the ship once. Dispatched in one task so
    // a slow runner can't split it into separate gestures.
    await page.waitForTimeout(300)
    const c = await center(cell(page, 'E5'))
    await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y)!
      for (let i = 0; i < 4; i++) {
        const init = { deltaY: 20, clientX: x, clientY: y, bubbles: true, cancelable: true }
        target.dispatchEvent(new WheelEvent('wheel', init))
      }
    }, c)
    await expect(rotate).toHaveAccessibleName('Rotate (facing west)')
    for (const facing of ['south', 'east']) {
      await page.waitForTimeout(300)
      await page.mouse.wheel(0, -100)
      await expect(rotate).toHaveAccessibleName(`Rotate (facing ${facing})`)
    }

    await mouseDrag(page, chip(page, 'Carrier'), cell(page, 'E5'))
    await expectShip(page, ['C5', 'G5'], 'carrier')
    await page.waitForTimeout(300)
    await wheelAt(cell(page, 'E5'))
    await expectShip(page, ['E3', 'E7'], 'carrier')
    await expectShip(page, ['C5', 'G5'], null)
    await expect(rotate).toHaveAccessibleName('Rotate (facing east)')

    const from = await center(chip(page, 'Battleship'))
    const to = await center(cell(page, 'B8'))
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 10 })
    await page.waitForTimeout(300)
    await page.mouse.wheel(0, 100)
    await page.mouse.up()
    await expectShip(page, ['B6', 'B9'], 'battleship')
    await expectShip(page, ['A8', 'C8'], null)
  })

  test('the wheel turns ships all the way round, and back', async ({ page }) => {
    const carrier = board(page).locator('[data-ship="carrier"]:not([data-preview])')
    const preview = board(page).locator('[data-ship="carrier"][data-preview]')
    const turn = async (target: Locator, dy: number) => {
      const c = await center(target)
      await page.mouse.move(c.x, c.y)
      await page.mouse.wheel(0, dy)
      await page.waitForTimeout(250)
    }

    await turn(cell(page, 'E5'), 100)
    await expect(preview).toHaveAttribute('data-facing', 'south')
    await expectShip(page, ['E5', 'E9'], null)
    for (const facing of ['west', 'north', 'east'])
      await turn(cell(page, 'E5'), 100).then(() =>
        expect(preview).toHaveAttribute('data-facing', facing),
      )

    await cell(page, 'E5').click()
    await expectShip(page, ['E5', 'I5'], 'carrier')
    await expect(carrier).toHaveAttribute('data-facing', 'east')
    const steps: [string, string[]][] = [
      ['south', ['E5', 'E9']],
      ['west', ['A5', 'E5']],
      ['north', ['E1', 'E5']],
      ['east', ['E5', 'I5']],
    ]
    // Each turn swings the ship a quarter-turn around E5, like a clock hand.
    for (const [facing, [a, b]] of steps) {
      await turn(cell(page, 'E5'), 100)
      await expect(carrier).toHaveAttribute('data-facing', facing)
      await expectShip(page, [a, b], 'carrier')
    }
    await turn(cell(page, 'E5'), -100)
    await expect(carrier).toHaveAttribute('data-facing', 'north')
    await expectShip(page, ['E1', 'E5'], 'carrier')
  })

  test('the wheel over the board does not scroll the page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 })
    const c = await center(cell(page, 'E5'))
    await page.mouse.move(c.x, c.y)
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await page.mouse.move(5, 5)
    await page.mouse.wheel(0, 300)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
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

test('fleet colors recolor the accents and are remembered', async ({ page }) => {
  const mine = page.getByRole('radiogroup', { name: 'Your fleet color' })
  const theirs = page.getByRole('radiogroup', { name: 'Enemy fleet color' })
  await expect(mine.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true')
  await expect(theirs.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true')
  await expect(mine.getByRole('radio')).toHaveCount(10)

  await mine.getByRole('radio', { name: 'Green' }).click()
  await theirs.getByRole('radio', { name: 'Purple' }).click()
  await expect(mine.getByRole('radio', { name: 'Green' })).toHaveAttribute('aria-checked', 'true')
  await expect(chip(page, 'Carrier').locator('[data-team="#22c55e"]')).toHaveCount(1)

  await page.getByRole('button', { name: 'Randomize' }).click()
  await expect(board(page).locator('[data-team="#22c55e"]')).toHaveCount(5)
  await page.getByRole('button', { name: 'Start battle' }).click()
  const myFleet = page.locator('[aria-label="Your fleet"]').first()
  await expect(myFleet.locator('[data-team="#22c55e"]')).toHaveCount(5)

  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('battleship:colors:v1')!)),
  ).toEqual({ human: 'green', ai: 'purple' })
})
