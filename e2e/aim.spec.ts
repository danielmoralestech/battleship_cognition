import { expect, test, type Page } from '@playwright/test'

type Hook = { enemyCellToScreen(row: number, col: number): { x: number; y: number } }

const enemy = (page: Page) => page.getByRole('grid', { name: 'Enemy waters' })
const cell = (page: Page, label: string) => enemy(page).locator(`[data-coord="${label}"]`)
const shots = (page: Page, n: number) => expect(page.getByText(new RegExp(`Your shots: ${n}\\b`)))
const yourTurn = (page: Page) =>
  expect(page.getByTestId('turn-indicator')).toContainText('Your turn')

async function startBattle(page: Page, query = '') {
  await page.goto(`./?difficulty=easy${query}`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
}

async function setAim(page: Page, isMobile: boolean, on: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Game menu' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
  } else await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  const aim = dialog.getByRole('switch', { name: 'Aim before firing' })
  if ((await aim.getAttribute('aria-checked')) !== String(on)) await aim.click()
  await expect(aim).toHaveAttribute('aria-checked', String(on))
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
}

test('aim before firing: first tap aims, second tap or Fire fires', async ({ page, isMobile }) => {
  await startBattle(page)
  await expect(enemy(page)).toBeVisible()
  // Off by default: one tap fires.
  await expect(page.getByRole('button', { name: /Fire at|Tap a square to aim/ })).toHaveCount(0)
  await cell(page, 'A1').click()
  await shots(page, 1).toBeVisible()

  await setAim(page, isMobile, true)
  await yourTurn(page)
  await expect(page.getByTestId('turn-indicator')).toContainText('aim at enemy waters')
  await expect(page.getByRole('button', { name: 'Tap a square to aim' })).toBeDisabled()

  await cell(page, 'E5').click()
  await expect(cell(page, 'E5')).toHaveAttribute('aria-label', 'E5, aimed, activate again to fire')
  await expect(page.getByRole('button', { name: 'Fire at E5' })).toBeEnabled()
  await shots(page, 1).toBeVisible()

  // A different square moves the aim; tapping it again fires.
  await cell(page, 'F6').click()
  await expect(cell(page, 'E5')).not.toHaveAttribute('data-aimed')
  await expect(page.getByRole('button', { name: 'Fire at F6' })).toBeVisible()
  await cell(page, 'F6').click()
  await shots(page, 2).toBeVisible()
  await expect(enemy(page).locator('[data-aimed]')).toHaveCount(0)

  // The Fire button fires at the aimed square.
  await yourTurn(page)
  await cell(page, 'G7').click()
  await page.getByRole('button', { name: 'Fire at G7' }).click()
  await shots(page, 2 + 1).toBeVisible()
  await expect(cell(page, 'G7')).not.toHaveAttribute('data-shot', '')

  // Switching the setting off and on again forgets the aim.
  await yourTurn(page)
  await cell(page, 'J10').click()
  await expect(cell(page, 'J10')).toHaveAttribute('data-aimed', 'true')
  await setAim(page, isMobile, false)
  await setAim(page, isMobile, true)
  await expect(enemy(page).locator('[data-aimed]')).toHaveCount(0)
  await cell(page, 'J10').click()
  await expect(cell(page, 'J10')).toHaveAttribute('data-aimed', 'true')
  await shots(page, 3).toBeVisible()
  await cell(page, 'J10').click()
  await shots(page, 4).toBeVisible()

  // Keyboard: Enter aims, Enter again fires.
  await yourTurn(page)
  await cell(page, 'H8').focus()
  await page.keyboard.press('Enter')
  await expect(cell(page, 'H8')).toHaveAttribute('data-aimed', 'true')
  await shots(page, 4).toBeVisible()
  await page.keyboard.press('Enter')
  await shots(page, 5).toBeVisible()

  // Remembered across a reload, and switching it off fires on one tap again.
  await page.reload()
  await yourTurn(page)
  await expect(page.getByRole('button', { name: 'Tap a square to aim' })).toBeVisible()
  await setAim(page, isMobile, false)
  await cell(page, 'B2').click()
  await shots(page, 6).toBeVisible()
})

test('aim before firing in 3D: tap aims, Fire button and second tap fire', async ({
  page,
  isMobile,
}) => {
  await page.goto('./?difficulty=easy&view=3d')
  const webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
  test.skip(!webgl2, 'WebGL 2 is not available in this browser')
  await page.evaluate(() =>
    localStorage.setItem(
      'battleship:settings:v1',
      JSON.stringify({ sound: true, aimToFire: true }),
    ),
  )
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
  await page.waitForFunction(() => '__battle3d' in window)
  await expect(page.getByTestId('turn-indicator')).toContainText('tap enemy waters to aim')

  const tap = async (row: number, col: number) => {
    const p = await page.evaluate(
      ([r, c]) => (window as unknown as { __battle3d: Hook }).__battle3d.enemyCellToScreen(r, c),
      [row, col],
    )
    if (isMobile) await page.touchscreen.tap(p.x, p.y)
    else await page.mouse.click(p.x, p.y)
  }

  await tap(4, 4)
  const fireAt = page.getByRole('button', { name: 'Fire at E5' })
  await expect(fireAt).toBeVisible()
  const box = (await fireAt.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  if (isMobile) {
    // On an upright phone it is a full-size button centred above the status bar.
    const width = page.viewportSize()!.width
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(4)
    expect(box.width).toBeGreaterThanOrEqual(width / 2)
  }
  await shots(page, 0).toBeVisible()
  await tap(4, 4)
  await shots(page, 1).toBeVisible()

  await yourTurn(page)
  await tap(6, 2)
  await page.getByRole('button', { name: 'Fire at C7' }).click()
  await shots(page, 2).toBeVisible()
})
