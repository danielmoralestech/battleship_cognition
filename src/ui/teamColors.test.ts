import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadColors, saveColors } from '../storage/persist'
import { DEFAULT_FLEET_COLORS, TEAM_COLOR_NAMES, TEAM_COLORS } from './teamColors'

function stubStorage() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  })
  return data
}

afterEach(() => vi.unstubAllGlobals())

describe('team colors', () => {
  it('offers the ten named colors as distinct hex values', () => {
    expect(TEAM_COLOR_NAMES).toEqual([
      'red',
      'blue',
      'yellow',
      'orange',
      'green',
      'teal',
      'purple',
      'black',
      'white',
      'grey',
    ])
    const hexes = Object.values(TEAM_COLORS)
    expect(new Set(hexes).size).toBe(10)
    for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('defaults to blue vs red and remembers the picks', () => {
    stubStorage()
    expect(loadColors()).toEqual(DEFAULT_FLEET_COLORS)
    expect(DEFAULT_FLEET_COLORS).toEqual({ human: 'blue', ai: 'red' })
    saveColors({ human: 'green', ai: 'green' })
    expect(loadColors()).toEqual({ human: 'green', ai: 'green' })
  })

  it('ignores unknown saved colors', () => {
    const data = stubStorage()
    data.set('battleship:colors:v1', JSON.stringify({ human: 'pink', ai: 'white' }))
    expect(loadColors()).toEqual({ human: 'blue', ai: 'white' })
  })
})
