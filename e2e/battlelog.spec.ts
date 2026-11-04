import { expect, test, type Page } from '@playwright/test'

type Hook = { enemyCellToScreen(row: number, col: number): { x: number; y: number } }

const enemy = (page: Page) => page.getByRole('grid', { name: 'Enemy waters' })
const bubble = (page: Page) => page.getByRole('button', { name: /Battle log$/ })
const turn = (page: Page) => page.getByTestId('turn-indicator')
const panel = (page: Page) => page.getByText(/^Battle log · \d+ shots?$/)

async function startBattle(page: Page, query = '') {
  await page.goto(`./?difficulty=easy${query}`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
}

async function tapAt(page: Page, isMobile: boolean, { x, y }: { x: number; y: number }) {
  if (isMobile) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

test('2D: tapping the result bubble drops down the battle log', async ({ page, isMobile }) => {
  await startBattle(page)
  await expect(page.locator('details')).toHaveCount(0)

  const cell = enemy(page).locator('[data-coord="E5"]')
  await cell.click()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()
  await expect(turn(page)).toContainText('Your turn')

  await expect(bubble(page)).toHaveAttribute('aria-expanded', 'false')
  await bubble(page).click()
  await expect(bubble(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(panel(page)).toBeVisible()
  const list = page.locator(`#${await bubble(page).getAttribute('aria-controls')}`)
  await expect(list.getByRole('listitem').first()).toContainText('Enemy')
  await expect(list).toContainText('You E5:')

  // A tap outside closes the log without firing at the cell underneath.
  const box = (await enemy(page).locator('[data-coord="H8"]').boundingBox())!
  await tapAt(page, isMobile, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  await expect(panel(page)).toBeHidden()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()

  await bubble(page).focus()
  await page.keyboard.press('Enter')
  await expect(panel(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel(page)).toBeHidden()
  await expect(bubble(page)).toBeFocused()

  await bubble(page).click()
  await bubble(page).click()
  await expect(panel(page)).toBeHidden()
})

test('3D: tapping the result bubble drops down the battle log', async ({ page, isMobile }) => {
  await page.goto('./?difficulty=easy&view=3d')
  const webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
  test.skip(!webgl2, 'WebGL 2 is not available in this browser')
  await startBattle(page, '&view=3d')

  await page.waitForFunction(() => '__battle3d' in window)
  const cellAt = (row: number, col: number) =>
    page.evaluate(
      ([r, c]) => (window as unknown as { __battle3d: Hook }).__battle3d.enemyCellToScreen(r, c),
      [row, col],
    )
  await tapAt(page, isMobile, await cellAt(4, 4))
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()
  await expect(turn(page)).toContainText('Your turn')

  await bubble(page).click()
  await expect(panel(page)).toBeVisible()
  await expect(page.locator(`#${await bubble(page).getAttribute('aria-controls')}`)).toContainText(
    'You E5:',
  )

  await tapAt(page, isMobile, await cellAt(7, 7))
  await expect(panel(page)).toBeHidden()

  // The bottom HUD sits under the backdrop too: tapping it only closes the log.
  await bubble(page).click()
  const stats = (await page.getByText(/Your shots: 1\b/).boundingBox())!
  await tapAt(page, isMobile, { x: stats.x + 4, y: stats.y + 4 })
  await expect(panel(page)).toBeHidden()
  if (isMobile) {
    const fleet = page.getByRole('button', { name: 'Your fleet' })
    await bubble(page).click()
    const box = (await fleet.boundingBox())!
    await tapAt(page, isMobile, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    await expect(panel(page)).toBeHidden()
    await expect(fleet).toHaveAttribute('aria-pressed', 'false')
  }
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()
})
