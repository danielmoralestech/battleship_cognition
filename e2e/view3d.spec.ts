import { expect, test } from '@playwright/test'

type Hook = { enemyCellToScreen(row: number, col: number): { x: number; y: number } }

// The 2D boards draw shot effects on their own canvases, marked with data-fx.
const SCENE = 'canvas:not([data-fx])'

test('?view=3d renders the battle in a WebGL canvas and fires on tap/click', async ({
  page,
  isMobile,
}) => {
  await page.goto('./?difficulty=easy&view=3d')
  const webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
  test.skip(!webgl2, 'WebGL 2 is not available in this browser')

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()

  const canvas = page.locator(SCENE)
  await expect(canvas).toBeVisible()
  // The canvas starts at the default 300×150 until react-three-fiber measures its container.
  await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(300)
  await expect(page.getByRole('grid', { name: 'Enemy waters' })).toHaveCount(0)

  await page.waitForFunction(() => '__battle3d' in window)
  const target = await page.evaluate(() =>
    (window as unknown as { __battle3d: Hook }).__battle3d.enemyCellToScreen(4, 4),
  )
  if (isMobile) await page.touchscreen.tap(target.x, target.y)
  else await page.mouse.click(target.x, target.y)
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()

  await page.getByRole('button', { name: '2D view' }).click()
  await expect(page.getByRole('grid', { name: 'Enemy waters' })).toBeVisible()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()
})

test('the game menu switches a 2D battle to 3D and the choice survives a reload', async ({
  page,
  isMobile,
}) => {
  await page.goto('./?difficulty=easy')
  const webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
  test.skip(!webgl2, 'WebGL 2 is not available in this browser')

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
  await page.getByRole('grid', { name: 'Enemy waters' }).getByRole('gridcell').first().click()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()

  if (isMobile) await page.getByRole('button', { name: 'Game menu' }).click()
  await page.getByRole(isMobile ? 'menuitem' : 'button', { name: '3D view' }).click()
  await expect(page.locator(SCENE)).toBeVisible()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()

  await page.reload()
  await expect(page.locator(SCENE)).toBeVisible()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()

  await page.getByRole('button', { name: '2D view' }).click()
  await expect(page.getByRole('grid', { name: 'Enemy waters' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('grid', { name: 'Enemy waters' })).toBeVisible()
  await expect(page.locator(SCENE)).toHaveCount(0)
})
