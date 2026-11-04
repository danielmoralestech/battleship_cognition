import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './persist'

function stubStorage() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  })
  return data
}

describe('settings persistence', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to sound on', () => {
    stubStorage()
    expect(DEFAULT_SETTINGS.sound).toBe(true)
    expect(DEFAULT_SETTINGS.aimToFire).toBe(false)
    expect(loadSettings()).toEqual({ sound: true, aimToFire: false })
  })

  it('remembers sound off and aim before firing on', () => {
    stubStorage()
    saveSettings({ sound: false, aimToFire: true })
    expect(loadSettings()).toEqual({ sound: false, aimToFire: true })
  })

  it('reads settings saved before aim before firing existed', () => {
    const data = stubStorage()
    data.set('battleship:settings:v1', JSON.stringify({ sound: false }))
    expect(loadSettings()).toEqual({ sound: false, aimToFire: false })
  })

  it('ignores invalid saved values', () => {
    const data = stubStorage()
    data.set('battleship:settings:v1', JSON.stringify({ sound: 'loud', aimToFire: 1 }))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    data.set('battleship:settings:v1', '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
