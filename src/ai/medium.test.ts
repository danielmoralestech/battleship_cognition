import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import type { Coord, TargetView } from '../engine/types'
import { mediumAI } from './medium'
import { emptyRows, viewFromRows, withCells } from './test-utils'

const key = ({ row, col }: Coord) => `${row},${col}`

function shotsOver(view: TargetView, samples = 200): Set<string> {
  const rng = createRng(42)
  const seen = new Set<string>()
  for (let i = 0; i < samples; i++) seen.add(key(mediumAI.chooseShot(view, rng)))
  return seen
}

describe('mediumAI hunt mode', () => {
  it('hunts on a checkerboard when the destroyer is afloat', () => {
    for (const k of shotsOver(viewFromRows(emptyRows()))) {
      const [row, col] = k.split(',').map(Number)
      expect((row + col) % 2).toBe(0)
    }
  })

  it('widens the parity spacing to the smallest remaining ship', () => {
    const view = viewFromRows(emptyRows(), { sunk: ['destroyer'] })
    for (const k of shotsOver(view)) {
      const [row, col] = k.split(',').map(Number)
      expect((row + col) % 3).toBe(0)
    }
  })

  it('falls back to any unknown cell once parity cells are used up', () => {
    const rows = emptyRows(4).map((r, row) =>
      [...r].map((_, col) => ((row + col) % 2 === 0 ? 'o' : '.')).join(''),
    )
    const view = viewFromRows(rows)
    const { row, col } = mediumAI.chooseShot(view, createRng(1))
    expect(view.cells[row][col]).toBe('unknown')
  })

  it('ignores sunk ships', () => {
    const rows = withCells(emptyRows(), '#', [
      [0, 0],
      [0, 1],
    ])
    for (const k of shotsOver(viewFromRows(rows, { sunk: ['destroyer'] }))) {
      const [row, col] = k.split(',').map(Number)
      expect((row + col) % 3).toBe(0)
    }
  })
})

describe('mediumAI target mode', () => {
  it('probes the orthogonal neighbors of a single hit', () => {
    const view = viewFromRows(withCells(emptyRows(), 'X', [[5, 5]]))
    expect(shotsOver(view)).toEqual(new Set(['4,5', '6,5', '5,4', '5,6']))
  })

  it('stays in bounds around a corner hit', () => {
    const view = viewFromRows(withCells(emptyRows(), 'X', [[0, 0]]))
    expect(shotsOver(view)).toEqual(new Set(['0,1', '1,0']))
  })

  it('extends a line of hits in both directions', () => {
    const view = viewFromRows(
      withCells(emptyRows(), 'X', [
        [3, 4],
        [4, 4],
      ]),
    )
    expect(shotsOver(view)).toEqual(new Set(['2,4', '5,4']))
  })

  it('extends only the open end of a line', () => {
    let rows = withCells(emptyRows(), 'X', [
      [6, 1],
      [6, 2],
      [6, 3],
    ])
    rows = withCells(rows, 'o', [[6, 4]])
    expect(shotsOver(viewFromRows(rows))).toEqual(new Set(['6,0']))
  })

  it('falls back to the neighbors of the hits when a line is capped (adjacent ships)', () => {
    let rows = withCells(emptyRows(), 'X', [
      [6, 0],
      [6, 1],
      [6, 2],
    ])
    rows = withCells(rows, 'o', [[6, 3]])
    expect(shotsOver(viewFromRows(rows))).toEqual(
      new Set(['5,0', '7,0', '5,1', '7,1', '5,2', '7,2']),
    )
  })

  it('works the longest open line first', () => {
    const rows = withCells(emptyRows(), 'X', [
      [0, 5],
      [0, 6],
      [5, 2],
      [6, 2],
      [7, 2],
    ])
    expect(shotsOver(viewFromRows(rows))).toEqual(new Set(['4,2', '8,2']))
  })

  it('finds the last unknown cell', () => {
    const rows = withCells(
      emptyRows().map((r) => 'o'.repeat(r.length)),
      '.',
      [[9, 9]],
    )
    const view = viewFromRows(withCells(rows, 'X', [[0, 0]]))
    expect(mediumAI.chooseShot(view, createRng(1))).toEqual({ row: 9, col: 9 })
  })

  it('hunts again when hits are boxed in (sinks not announced)', () => {
    let rows = withCells(emptyRows(), 'X', [[0, 0]])
    rows = withCells(rows, 'o', [
      [0, 1],
      [1, 0],
    ])
    for (const k of shotsOver(viewFromRows(rows))) {
      const [row, col] = k.split(',').map(Number)
      expect((row + col) % 2).toBe(0)
      expect(rows[row][col]).toBe('.')
    }
  })
})
