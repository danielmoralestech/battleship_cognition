import { describe, expect, it } from 'vitest'
import { createBoard, receiveShot } from './board'
import { STANDARD_RULES } from './rules'
import { getTargetView } from './view'

describe('getTargetView', () => {
  const board0 = createBoard([
    { type: 'destroyer', length: 2, orientation: 'horizontal', origin: { row: 0, col: 0 } },
    { type: 'cruiser', length: 3, orientation: 'vertical', origin: { row: 5, col: 5 } },
  ])

  it('hides unshot ships and shows hits, misses and sunk ships', () => {
    let board = receiveShot(board0, { row: 0, col: 0 }, 10).board
    board = receiveShot(board, { row: 0, col: 1 }, 10).board
    board = receiveShot(board, { row: 5, col: 5 }, 10).board
    board = receiveShot(board, { row: 9, col: 9 }, 10).board
    const view = getTargetView(board, STANDARD_RULES)
    expect(view.cells[0][0]).toBe('sunk')
    expect(view.cells[0][1]).toBe('sunk')
    expect(view.cells[5][5]).toBe('hit')
    expect(view.cells[6][5]).toBe('unknown')
    expect(view.cells[9][9]).toBe('miss')
    expect(view.sunkShips.map((s) => s.type)).toEqual(['destroyer'])
    expect(view.remainingShips.map((s) => s.type)).not.toContain('destroyer')
  })

  it('does not reveal sinks when announceSinks is off', () => {
    let board = receiveShot(board0, { row: 0, col: 0 }, 10).board
    board = receiveShot(board, { row: 0, col: 1 }, 10).board
    const view = getTargetView(board, { ...STANDARD_RULES, announceSinks: false })
    expect(view.cells[0][0]).toBe('hit')
    expect(view.sunkShips).toEqual([])
    expect(view.remainingShips).toHaveLength(STANDARD_RULES.fleet.length)
  })
})
