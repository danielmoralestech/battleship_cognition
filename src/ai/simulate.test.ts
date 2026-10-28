import { describe, expect, it } from 'vitest'
import { coordKey } from '../engine/board'
import { createRng } from '../engine/rng'
import { STANDARD_RULES } from '../engine/rules'
import type { Difficulty, RuleSet, TargetCell } from '../engine/types'
import { createAI } from './index'
import { averageShotsToWin, simulateGame } from './simulate'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const RULE_VARIANTS: Record<string, RuleSet> = {
  standard: STANDARD_RULES,
  'sinks not announced': { ...STANDARD_RULES, announceSinks: false },
  'no touching': { ...STANDARD_RULES, allowTouching: false },
  'small grid': {
    ...STANDARD_RULES,
    gridSize: 6,
    fleet: STANDARD_RULES.fleet.filter((s) => s.length <= 3),
  },
}

describe('createAI', () => {
  it.each(DIFFICULTIES)('returns the %s AI', (difficulty) => {
    expect(createAI(difficulty).difficulty).toBe(difficulty)
  })
})

describe('simulateGame', () => {
  it('is deterministic for a seed', () => {
    const ai = createAI('hard')
    expect(simulateGame(ai, STANDARD_RULES, 9)).toEqual(simulateGame(ai, STANDARD_RULES, 9))
  })
})

describe('property: AIs never repeat a shot or pick an invalid cell', () => {
  for (const [name, rules] of Object.entries(RULE_VARIANTS)) {
    it.each(DIFFICULTIES)(`%s, ${name} rules`, (difficulty) => {
      const ai = createAI(difficulty)
      for (let seed = 1; seed <= 40; seed++) {
        const { moves, shots } = simulateGame(ai, rules, seed)
        expect(new Set(moves.map(coordKey)).size).toBe(shots)
        expect(shots).toBeLessThanOrEqual(rules.gridSize ** 2)
      }
    })
  }

  it.each(DIFFICULTIES)('%s returns an unknown cell on arbitrary views', (difficulty) => {
    const ai = createAI(difficulty)
    const rng = createRng(11)
    const states: TargetCell[] = ['unknown', 'miss', 'hit', 'sunk']
    for (let i = 0; i < 300; i++) {
      const gridSize = 1 + rng.int(10)
      const cells = Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => states[rng.int(states.length)]),
      )
      cells[rng.int(gridSize)][rng.int(gridSize)] = 'unknown'
      const remainingShips = STANDARD_RULES.fleet.filter(() => rng.next() < 0.6)
      const { row, col } = ai.chooseShot({ gridSize, cells, remainingShips, sunkShips: [] }, rng)
      expect(cells[row]?.[col]).toBe('unknown')
    }
  })
})

describe('simulation: average shots to win', () => {
  it('orders hard < medium < easy over 200 seeded games each', () => {
    const [easy, medium, hard] = DIFFICULTIES.map((d) =>
      averageShotsToWin(createAI(d), STANDARD_RULES, 200),
    )
    expect(hard).toBeLessThan(medium)
    expect(medium).toBeLessThan(easy)
    expect(easy).toBeGreaterThan(85)
    expect(easy).toBeLessThanOrEqual(100)
    expect(medium).toBeGreaterThan(40)
    expect(medium).toBeLessThan(75)
    expect(hard).toBeGreaterThan(35)
    expect(hard).toBeLessThan(60)
  })
})
