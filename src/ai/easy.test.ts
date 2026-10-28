import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { easyAI } from './easy'
import { emptyRows, viewFromRows, withCells } from './test-utils'

describe('easyAI', () => {
  it('only shoots unknown cells', () => {
    const rows = withCells(emptyRows(), 'o', [
      [0, 0],
      [1, 1],
    ])
    const view = viewFromRows(withCells(rows, 'X', [[2, 2]]))
    const rng = createRng(1)
    for (let i = 0; i < 500; i++) {
      const { row, col } = easyAI.chooseShot(view, rng)
      expect(view.cells[row][col]).toBe('unknown')
    }
  })

  it('spreads shots across the whole board', () => {
    const view = viewFromRows(emptyRows())
    const rng = createRng(2)
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const { row, col } = easyAI.chooseShot(view, rng)
      seen.add(`${row},${col}`)
    }
    expect(seen.size).toBe(100)
  })

  it('finds the last unknown cell', () => {
    const rows = emptyRows().map((r) => 'o'.repeat(r.length))
    const view = viewFromRows(withCells(rows, '.', [[7, 3]]))
    expect(easyAI.chooseShot(view, createRng(3))).toEqual({ row: 7, col: 3 })
  })

  it('throws when nothing is left to shoot', () => {
    const view = viewFromRows(emptyRows(3).map(() => 'ooo'))
    expect(() => easyAI.chooseShot(view, createRng(4))).toThrow()
  })
})
