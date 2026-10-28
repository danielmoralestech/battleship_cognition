import { describe, expect, it } from 'vitest'
import {
  allShipsSunk,
  createBoard,
  isFleetComplete,
  randomPlacement,
  receiveShot,
  shipCells,
  validatePlacement,
} from './board'
import { createRng } from './rng'
import { STANDARD_RULES } from './rules'
import type { PlacedShip } from './types'

const destroyer = (
  row: number,
  col: number,
  orientation: PlacedShip['orientation'] = 'horizontal',
): PlacedShip => ({
  type: 'destroyer',
  length: 2,
  orientation,
  origin: { row, col },
})

describe('validatePlacement', () => {
  it('accepts a valid ship', () => {
    expect(validatePlacement([], destroyer(0, 0), STANDARD_RULES)).toBeNull()
  })

  it('rejects out-of-bounds ships', () => {
    expect(validatePlacement([], destroyer(0, 9), STANDARD_RULES)).toBe('out_of_bounds')
    expect(validatePlacement([], destroyer(9, 0, 'vertical'), STANDARD_RULES)).toBe('out_of_bounds')
  })

  it('rejects overlapping ships', () => {
    const carrier: PlacedShip = {
      type: 'carrier',
      length: 5,
      orientation: 'vertical',
      origin: { row: 0, col: 1 },
    }
    expect(validatePlacement([carrier], destroyer(0, 0), STANDARD_RULES)).toBe('overlap')
  })

  it('allows touching ships by default and rejects them when disabled', () => {
    const carrier: PlacedShip = {
      type: 'carrier',
      length: 5,
      orientation: 'horizontal',
      origin: { row: 1, col: 0 },
    }
    expect(validatePlacement([carrier], destroyer(0, 0), STANDARD_RULES)).toBeNull()
    expect(
      validatePlacement([carrier], destroyer(0, 0), { ...STANDARD_RULES, allowTouching: false }),
    ).toBe('touching')
  })

  it('ignores the same ship type so ships can be moved', () => {
    expect(validatePlacement([destroyer(0, 0)], destroyer(0, 1), STANDARD_RULES)).toBeNull()
  })

  it('rejects wrong lengths', () => {
    expect(validatePlacement([], { ...destroyer(0, 0), length: 3 }, STANDARD_RULES)).toBe(
      'wrong_length',
    )
  })
})

describe('randomPlacement', () => {
  it('produces a complete, valid fleet', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ships = randomPlacement(STANDARD_RULES, createRng(seed))
      expect(isFleetComplete(ships, STANDARD_RULES)).toBe(true)
      for (const ship of ships) expect(validatePlacement(ships, ship, STANDARD_RULES)).toBeNull()
    }
  })
})

describe('receiveShot', () => {
  it('reports miss, hit, sunk and detects a win', () => {
    let board = createBoard([destroyer(0, 0)])
    const miss = receiveShot(board, { row: 5, col: 5 }, 10)
    expect(miss.result).toBe('miss')
    board = miss.board
    const hit = receiveShot(board, { row: 0, col: 0 }, 10)
    expect(hit.result).toBe('hit')
    board = hit.board
    expect(allShipsSunk(board)).toBe(false)
    const sunk = receiveShot(board, { row: 0, col: 1 }, 10)
    expect(sunk).toMatchObject({ result: 'sunk', sunkShip: 'destroyer' })
    expect(allShipsSunk(sunk.board)).toBe(true)
  })

  it('rejects repeated and out-of-bounds shots', () => {
    const { board } = receiveShot(createBoard([destroyer(0, 0)]), { row: 3, col: 3 }, 10)
    expect(() => receiveShot(board, { row: 3, col: 3 }, 10)).toThrow()
    expect(() => receiveShot(board, { row: 10, col: 0 }, 10)).toThrow()
  })
})

describe('shipCells', () => {
  it('expands vertical ships downward', () => {
    expect(shipCells(destroyer(2, 3, 'vertical'))).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 3 },
    ])
  })
})
