import { expect, test, type Page } from '@playwright/test'

const enemy = (page: Page) => page.getByRole('grid', { name: 'Enemy waters' })
const sounds = (page: Page) => page.evaluate(() => window.__sounds ?? [])

async function startBattle(page: Page) {
  await page.goto('./?difficulty=easy')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Start battle' }).click()
  await expect(enemy(page)).toBeVisible()
}

async function fire(page: Page, label: string, shots: number) {
  await expect(page.getByTestId('turn-indicator')).toContainText('Your turn')
  await enemy(page).locator(`[data-coord="${label}"]`).click()
  await expect(page.getByText(new RegExp(`Your shots: ${shots}\\b`))).toBeVisible()
}

async function openSettings(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Game menu' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
  } else {
    await page.getByRole('button', { name: 'Settings' }).click()
  }
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('shots play sounds, and the Sound switch mutes them and is remembered', async ({
  page,
  isMobile,
}) => {
  await startBattle(page)
  await fire(page, 'E5', 1)
  await expect.poll(() => sounds(page)).toEqual(expect.arrayContaining(['fire', 'whistle']))
  expect((await sounds(page)).some((c) => ['splash', 'hit', 'sink'].includes(c))).toBe(true)

  const dialog = await openSettings(page, isMobile)
  const sound = dialog.getByRole('switch', { name: 'Sound' })
  await expect(sound).toHaveAttribute('aria-checked', 'true')
  await expect(sound).toBeFocused()
  // Tab stays inside the dialog.
  const done = dialog.getByRole('button', { name: 'Done' })
  await page.keyboard.press('Tab')
  await expect(done).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(sound).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(done).toBeFocused()
  await sound.click()
  await expect(sound).toHaveAttribute('aria-checked', 'false')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()

  await page.evaluate(() => (window.__sounds = []))
  await fire(page, 'F6', 2)
  await expect(page.getByTestId('turn-indicator')).toContainText('Your turn')
  expect(await sounds(page)).toEqual([])

  await page.reload()
  const reopened = await openSettings(page, isMobile)
  await expect(reopened.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await page.keyboard.press('Escape')
  await expect(reopened).toBeHidden()
})
