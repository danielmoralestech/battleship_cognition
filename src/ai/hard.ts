import type { Coord, Rng, TargetView } from '../engine/types'
import { cellsInState, pickRandom } from './shared'
import type { AIPlayer } from './types'

/** Multiplier per unresolved hit a placement covers, in target mode. */
export const HIT_WEIGHT = 50

/**
 * Probability density: for every remaining ship, every horizontal/vertical placement
 * that avoids misses and sunk cells adds weight to the unknown cells it covers.
 * In target mode only placements through at least one unresolved hit count, weighted
 * by `HIT_WEIGHT ** hitsCovered`.
 */
export function densityMap(view: TargetView, targetMode: boolean): number[][] {
  const size = view.gridSize
  const { cells } = view
  const density = Array.from({ length: size }, () => new Array<number>(size).fill(0))

  for (const { length } of view.remainingShips) {
    if (length > size) continue
    for (const vertical of [false, true]) {
      const maxRow = vertical ? size - length : size - 1
      const maxCol = vertical ? size - 1 : size - length
      for (let row = 0; row <= maxRow; row++) {
        for (let col = 0; col <= maxCol; col++) {
          let hits = 0
          let blocked = false
          for (let i = 0; i < length; i++) {
            const cell = vertical ? cells[row + i][col] : cells[row][col + i]
            if (cell === 'hit') hits++
            else if (cell !== 'unknown') {
              blocked = true
              break
            }
          }
          if (blocked || hits === length || (targetMode && hits === 0)) continue
          const weight = targetMode ? HIT_WEIGHT ** hits : 1
          for (let i = 0; i < length; i++) {
            const r = vertical ? row + i : row
            const c = vertical ? col : col + i
            if (cells[r][c] === 'unknown') density[r][c] += weight
          }
        }
      }
    }
  }
  return density
}

function bestCells(view: TargetView, density: number[][]): Coord[] {
  let best = 0
  let result: Coord[] = []
  for (let row = 0; row < view.gridSize; row++) {
    for (let col = 0; col < view.gridSize; col++) {
      const score = density[row][col]
      if (view.cells[row][col] !== 'unknown' || score < best || score === 0) continue
      if (score > best) {
        best = score
        result = []
      }
      result.push({ row, col })
    }
  }
  return result
}

export function chooseHardShot(view: TargetView, rng: Rng): Coord {
  const hasUnresolvedHits = view.cells.some((row) => row.includes('hit'))
  let candidates = hasUnresolvedHits ? bestCells(view, densityMap(view, true)) : []
  // No placement can extend the hits (e.g. unannounced sinks): hunt instead.
  if (candidates.length === 0) candidates = bestCells(view, densityMap(view, false))
  if (candidates.length === 0) candidates = cellsInState(view, 'unknown')
  return pickRandom(candidates, rng)
}

export const hardAI: AIPlayer = {
  difficulty: 'hard',
  chooseShot: chooseHardShot,
}
