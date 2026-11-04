import { describe, expect, it } from 'vitest'
import {
  coordLabel,
  allShipsSunk,
  anchorShip,
  createBoard,
  isFleetComplete,
  nearestValidPlacement,
  randomPlacement,
  receiveShot,
  rotateShip,
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

const cruiser = (row: number, col: number): PlacedShip => ({
  type: 'cruiser',
  length: 3,
  orientation: 'horizontal',
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

const carrier = (
  row: number,
  col: number,
  orientation: PlacedShip['orientation'] = 'horizontal',
): PlacedShip => ({ type: 'carrier', length: 5, orientation, origin: { row, col } })

describe('anchorShip', () => {
  it('puts the grabbed segment on the target cell', () => {
    expect(anchorShip(carrier(0, 0), { row: 4, col: 4 }, 2, 10).origin).toEqual({ row: 4, col: 2 })
    expect(anchorShip(carrier(0, 0, 'vertical'), { row: 4, col: 4 }, 2, 10).origin).toEqual({
      row: 2,
      col: 4,
    })
  })

  it('clamps the ship onto the board', () => {
    expect(anchorShip(carrier(0, 0), { row: 9, col: 9 }, 0, 10).origin).toEqual({ row: 9, col: 5 })
    expect(anchorShip(carrier(0, 0, 'vertical'), { row: 0, col: 0 }, 4, 10).origin).toEqual({
      row: 0,
      col: 0,
    })
  })
})

describe('nearestValidPlacement', () => {
  it('returns the candidate when it is already valid', () => {
    expect(nearestValidPlacement([], destroyer(3, 3), STANDARD_RULES)).toEqual(destroyer(3, 3))
  })

  it('moves to the closest free spot when blocked', () => {
    const blocker = carrier(3, 0)
    const result = nearestValidPlacement([blocker], destroyer(3, 0), STANDARD_RULES)!
    expect(validatePlacement([blocker], result, STANDARD_RULES)).toBeNull()
    expect(Math.abs(result.origin.row - 3) + Math.abs(result.origin.col)).toBe(1)
  })
})

describe('rotateShip', () => {
  it('rotates around the tapped cell', () => {
    const rotated = rotateShip([], carrier(4, 2), { row: 4, col: 4 }, STANDARD_RULES)
    expect(rotated).toEqual({ ...carrier(2, 4, 'vertical'), facing: 'south' })
  })

  it('shifts to stay on the board', () => {
    const rotated = rotateShip([], carrier(0, 0), { row: 0, col: 0 }, STANDARD_RULES)
    expect(rotated).toEqual({ ...carrier(0, 0, 'vertical'), facing: 'south' })
  })

  it('turns all the way round in four clockwise steps, swinging around the pivot', () => {
    const pivot = { row: 4, col: 4 }
    let ship: PlacedShip = cruiser(4, 4)
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      ship = rotateShip([], ship, pivot, STANDARD_RULES)!
      seen.push(`${ship.facing} ${shipCells(ship).map(coordLabel).join(' ')}`)
    }
    expect(seen).toEqual(['south E5 E6 E7', 'west C5 D5 E5', 'north E3 E4 E5', 'east E5 F5 G5'])
  })

  it('turns anticlockwise when asked', () => {
    const ship = rotateShip([], cruiser(4, 4), { row: 4, col: 4 }, STANDARD_RULES, -1)!
    expect(ship.facing).toBe('north')
    expect(shipCells(ship).map(coordLabel)).toEqual(['E3', 'E4', 'E5'])
    expect(rotateShip([], ship, { row: 4, col: 4 }, STANDARD_RULES, 1)).toEqual({
      ...cruiser(4, 4),
      facing: 'east',
    })
  })

  it('nudges around other ships', () => {
    const others = [destroyer(5, 4)]
    const rotated = rotateShip(others, carrier(3, 2), { row: 3, col: 4 }, STANDARD_RULES)!
    expect(rotated.orientation).toBe('vertical')
    expect(validatePlacement(others, rotated, STANDARD_RULES)).toBeNull()
  })

  it('returns null when the rotated ship fits nowhere', () => {
    const rules = { ...STANDARD_RULES, gridSize: 5 }
    const others: PlacedShip[] = [
      { type: 'cruiser', length: 3, orientation: 'horizontal', origin: { row: 0, col: 0 } },
      destroyer(0, 3),
    ]
    expect(rotateShip(others, carrier(4, 0), { row: 4, col: 0 }, rules)).toBeNull()
  })
})
