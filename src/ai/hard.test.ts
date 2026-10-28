import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import type { Coord, TargetView } from '../engine/types'
import { chooseHardShot, densityMap, hardAI } from './hard'
import { emptyRows, viewFromRows, withCells } from './test-utils'

const key = ({ row, col }: Coord) => `${row},${col}`

function shotsOver(view: TargetView, samples = 200): Set<string> {
  const rng = createRng(7)
  const seen = new Set<string>()
  for (let i = 0; i < samples; i++) seen.add(key(hardAI.chooseShot(view, rng)))
  return seen
}

describe('densityMap', () => {
  it('counts every placement covering a cell on an empty board', () => {
    const density = densityMap(viewFromRows(emptyRows()), false)
    // Corner: one horizontal + one vertical placement per ship.
    expect(density[0][0]).toBe(2 * 5)
    // Center: every ship of length L has L placements per orientation.
    expect(density[4][4]).toBe(2 * (5 + 4 + 3 + 3 + 2))
  })

  it('excludes placements that cover misses or sunk cells', () => {
    const fleet = [{ type: 'destroyer', name: 'Destroyer', length: 2 }] as const
    const rows = ['.o.', '...', '..#']
    const density = densityMap(viewFromRows(rows, { fleet: [...fleet] }), false)
    expect(density).toEqual([
      [1, 0, 1],
      [3, 3, 2],
      [2, 2, 0],
    ])
  })
})

describe('hardAI hunt mode', () => {
  it('opens in the densest (central) cells', () => {
    expect(shotsOver(viewFromRows(emptyRows()))).toEqual(new Set(['4,4', '4,5', '5,4', '5,5']))
  })

  it('avoids gaps too small for any remaining ship', () => {
    // Only the destroyer remains; the isolated cell at (0,0) can't hold it.
    const rows = withCells(emptyRows(), 'o', [
      [0, 1],
      [1, 0],
    ])
    const view = viewFromRows(rows, { sunk: ['carrier', 'battleship', 'cruiser', 'submarine'] })
    expect(shotsOver(view).has('0,0')).toBe(false)
  })
})

describe('hardAI target mode', () => {
  it('probes the neighbors of a single hit', () => {
    const view = viewFromRows(withCells(emptyRows(), 'X', [[5, 5]]))
    expect(shotsOver(view)).toEqual(new Set(['4,5', '6,5', '5,4', '5,6']))
  })

  it('extends along a line of hits', () => {
    const view = viewFromRows(
      withCells(emptyRows(), 'X', [
        [4, 4],
        [4, 5],
      ]),
    )
    expect(shotsOver(view)).toEqual(new Set(['4,3', '4,6']))
  })

  it('turns perpendicular when a line is capped by misses', () => {
    let rows = withCells(emptyRows(), 'X', [
      [5, 5],
      [5, 6],
    ])
    rows = withCells(rows, 'o', [
      [5, 4],
      [5, 7],
    ])
    for (const k of shotsOver(viewFromRows(rows))) expect(['4,5', '6,5', '4,6', '6,6']).toContain(k)
  })

  it('hunts again when hits are boxed in (sinks not announced)', () => {
    let rows = withCells(emptyRows(), 'X', [[0, 0]])
    rows = withCells(rows, 'o', [
      [0, 1],
      [1, 0],
    ])
    const view = viewFromRows(rows)
    for (const k of shotsOver(view)) {
      const [row, col] = k.split(',').map(Number)
      expect(view.cells[row][col]).toBe('unknown')
    }
  })

  it('finds the last unknown cell even when no ship fits there', () => {
    const rows = withCells(
      emptyRows().map((r) => 'o'.repeat(r.length)),
      '.',
      [[3, 8]],
    )
    const view = viewFromRows(withCells(rows, 'X', [[9, 9]]))
    expect(chooseHardShot(view, createRng(1))).toEqual({ row: 3, col: 8 })
  })

  it('stays well under 5 ms per move on 10x10', () => {
    let rows = withCells(emptyRows(), 'X', [
      [2, 2],
      [2, 3],
      [7, 7],
    ])
    rows = withCells(rows, 'o', [
      [0, 0],
      [4, 4],
      [9, 1],
    ])
    const views = [viewFromRows(emptyRows()), viewFromRows(rows)]
    const rng = createRng(3)
    const moves = 500
    const start = performance.now()
    for (let i = 0; i < moves; i++) hardAI.chooseShot(views[i % 2], rng)
    expect((performance.now() - start) / moves).toBeLessThan(1)
  })
})
