import { STANDARD_FLEET } from '../engine/rules'
import type { ShipSpec, ShipType, TargetCell, TargetView } from '../engine/types'

const CELL_BY_CHAR: Record<string, TargetCell> = {
  '.': 'unknown',
  o: 'miss',
  X: 'hit',
  '#': 'sunk',
}

/**
 * Builds a TargetView from rows such as `'..oX#'` (`.` unknown, `o` miss, `X` hit,
 * `#` sunk). Sunk ship types are removed from the remaining fleet.
 */
export function viewFromRows(
  rows: string[],
  { sunk = [], fleet = STANDARD_FLEET }: { sunk?: ShipType[]; fleet?: ShipSpec[] } = {},
): TargetView {
  const cells = rows.map((row) =>
    [...row].map((ch) => {
      const cell = CELL_BY_CHAR[ch]
      if (!cell) throw new Error(`Unknown cell char "${ch}"`)
      return cell
    }),
  )
  if (cells.some((row) => row.length !== rows.length)) throw new Error('Grid must be square')
  return {
    gridSize: rows.length,
    cells,
    remainingShips: fleet.filter((s) => !sunk.includes(s.type)),
    sunkShips: sunk.map((type) => ({ type, cells: [] })),
  }
}

export const emptyRows = (size = 10) => Array.from({ length: size }, () => '.'.repeat(size))

/** Returns `rows` with the given cells replaced by `ch`. */
export function withCells(rows: string[], ch: string, coords: [number, number][]): string[] {
  const grid = rows.map((r) => [...r])
  for (const [row, col] of coords) grid[row][col] = ch
  return grid.map((r) => r.join(''))
}
