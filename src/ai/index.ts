import type { Difficulty } from '../engine/types'
import type { AIPlayer } from './types'

// Placeholder: picks a random unknown cell for every difficulty until the real AIs land.
export function createAI(difficulty: Difficulty): AIPlayer {
  return {
    difficulty,
    chooseShot(view, rng) {
      const options = view.cells.flatMap((row, r) =>
        row.flatMap((cell, c) => (cell === 'unknown' ? [{ row: r, col: c }] : [])),
      )
      return options[rng.int(options.length)]
    },
  }
}

export type { AIPlayer } from './types'
