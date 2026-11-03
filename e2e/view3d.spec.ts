import { expect, test } from '@playwright/test'

type Hook = { enemyCellToScreen(row: number, col: number): { x: number; y: number } }

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

  const canvas = page.locator('canvas')
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

  await page.getByRole('link', { name: '2D view' }).click()
  await expect(page.getByRole('grid', { name: 'Enemy waters' })).toBeVisible()
  await expect(page.getByText(/Your shots: 1\b/)).toBeVisible()
})
