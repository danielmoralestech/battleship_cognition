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
    expect(loadSettings()).toEqual({ sound: true })
  })

  it('remembers sound off', () => {
    stubStorage()
    saveSettings({ sound: false })
    expect(loadSettings()).toEqual({ sound: false })
  })

  it('ignores invalid saved values', () => {
    const data = stubStorage()
    data.set('battleship:settings:v1', JSON.stringify({ sound: 'loud' }))
    expect(loadSettings()).toEqual({ sound: true })
    data.set('battleship:settings:v1', '{not json')
    expect(loadSettings()).toEqual({ sound: true })
  })
})
