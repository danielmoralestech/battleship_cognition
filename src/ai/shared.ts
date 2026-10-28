import { inBounds } from '../engine/board'
import type { Coord, Rng, TargetCell, TargetView } from '../engine/types'

export const ORTHOGONAL_STEPS: readonly Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
]

export function cellAt(view: TargetView, row: number, col: number): TargetCell | undefined {
  return inBounds({ row, col }, view.gridSize) ? view.cells[row][col] : undefined
}

export const isUnknown = (view: TargetView, row: number, col: number) =>
  cellAt(view, row, col) === 'unknown'

export function cellsInState(view: TargetView, state: TargetCell): Coord[] {
  const result: Coord[] = []
  for (let row = 0; row < view.gridSize; row++)
    for (let col = 0; col < view.gridSize; col++)
      if (view.cells[row][col] === state) result.push({ row, col })
  return result
}

export function pickRandom<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('No cells left to shoot at')
  return items[rng.int(items.length)]
}

export const randomUnknownCell = (view: TargetView, rng: Rng): Coord =>
  pickRandom(cellsInState(view, 'unknown'), rng)
