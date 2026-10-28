import { describe, expect, it } from 'vitest'
import { shipCells } from './board'
import { canFire, createInitialState, gameReducer } from './game'
import { STANDARD_RULES } from './rules'
import type { GameState } from './types'

const started = (seed = 1): GameState => {
  let s = createInitialState('easy')
  s = gameReducer(s, { type: 'RANDOMIZE_FLEET', seed })
  return gameReducer(s, { type: 'START_GAME', seed })
}

describe('gameReducer', () => {
  it('refuses to start without a complete fleet', () => {
    const s = createInitialState()
    expect(gameReducer(s, { type: 'START_GAME', seed: 1 })).toBe(s)
  })

  it('places, moves and removes ships during setup', () => {
    let s = createInitialState()
    s = gameReducer(s, {
      type: 'PLACE_SHIP',
      ship: { type: 'destroyer', length: 2, orientation: 'horizontal', origin: { row: 0, col: 0 } },
    })
    expect(s.boards.human.ships).toHaveLength(1)
    s = gameReducer(s, {
      type: 'PLACE_SHIP',
      ship: { type: 'destroyer', length: 2, orientation: 'vertical', origin: { row: 4, col: 4 } },
    })
    expect(s.boards.human.ships).toEqual([
      { type: 'destroyer', length: 2, orientation: 'vertical', origin: { row: 4, col: 4 } },
    ])
    const invalid = gameReducer(s, {
      type: 'PLACE_SHIP',
      ship: { type: 'carrier', length: 5, orientation: 'horizontal', origin: { row: 0, col: 8 } },
    })
    expect(invalid).toBe(s)
    s = gameReducer(s, { type: 'REMOVE_SHIP', shipType: 'destroyer' })
    expect(s.boards.human.ships).toHaveLength(0)
  })

  it('starts with a random AI fleet and a random first player', () => {
    const firsts = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      const s = started(seed)
      expect(s.phase).toBe('playing')
      expect(s.boards.ai.ships).toHaveLength(STANDARD_RULES.fleet.length)
      firsts.add(s.turn)
    }
    expect(firsts).toEqual(new Set(['human', 'ai']))
  })

  it('alternates turns and blocks out-of-turn and repeat shots', () => {
    let s = started()
    const shooter = s.turn
    const other = shooter === 'human' ? 'ai' : 'human'
    const coord = { row: 0, col: 0 }
    expect(gameReducer(s, { type: 'FIRE', by: other, coord })).toBe(s)
    s = gameReducer(s, { type: 'FIRE', by: shooter, coord })
    expect(s.turn).toBe(other)
    expect(s.log).toHaveLength(1)
    s = gameReducer(s, { type: 'FIRE', by: other, coord })
    expect(canFire(s, shooter, coord)).toBe(false)
    expect(gameReducer(s, { type: 'FIRE', by: shooter, coord })).toBe(s)
  })

  it('ends the game when every ship is sunk', () => {
    let s = started(3)
    s = { ...s, turn: 'human' }
    const targets = s.boards.ai.ships.flatMap(shipCells)
    targets.forEach((coord, i) => {
      s = { ...s, turn: 'human' }
      s = gameReducer(s, { type: 'FIRE', by: 'human', coord })
      if (i < targets.length - 1) expect(s.phase).toBe('playing')
    })
    expect(s.phase).toBe('gameOver')
    expect(s.winner).toBe('human')
    expect(s.log.filter((e) => e.result === 'sunk')).toHaveLength(5)
    expect(gameReducer(s, { type: 'FIRE', by: 'human', coord: { row: 9, col: 9 } })).toBe(s)
  })

  it('grants an extra shot on hit when the rule is enabled', () => {
    let s = started(5)
    s = { ...s, turn: 'human', rules: { ...s.rules, extraShotOnHit: true } }
    const coord = shipCells(s.boards.ai.ships[0])[0]
    s = gameReducer(s, { type: 'FIRE', by: 'human', coord })
    expect(s.turn).toBe('human')
  })

  it('resets to setup, optionally keeping the fleet', () => {
    const s = started()
    expect(gameReducer(s, { type: 'RESET' }).boards.human.ships).toHaveLength(0)
    const kept = gameReducer(s, { type: 'RESET', keepFleet: true })
    expect(kept.phase).toBe('setup')
    expect(kept.boards.human.ships).toEqual(s.boards.human.ships)
    expect(kept.boards.human.shots).toEqual({})
  })
})
