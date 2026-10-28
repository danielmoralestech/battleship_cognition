import {
  allShipsSunk,
  coordKey,
  createBoard,
  inBounds,
  randomPlacement,
  receiveShot,
} from '../engine/board'
import { createRng } from '../engine/rng'
import type { Coord, RuleSet } from '../engine/types'
import { getTargetView } from '../engine/view'
import type { AIPlayer } from './types'

export interface SimulationResult {
  shots: number
  moves: Coord[]
}

/**
 * Plays `ai` against a random fleet until every ship is sunk. Deterministic for a
 * given seed. Throws if the AI returns an out-of-bounds or already-shot cell.
 */
export function simulateGame(ai: AIPlayer, rules: RuleSet, seed: number): SimulationResult {
  const fleetRng = createRng(seed)
  const aiRng = createRng((seed ^ 0x5bd1e995) >>> 0)
  let board = createBoard(randomPlacement(rules, fleetRng))
  const moves: Coord[] = []
  const maxShots = rules.gridSize * rules.gridSize

  while (!allShipsSunk(board)) {
    if (moves.length >= maxShots) throw new Error(`${ai.difficulty} AI exceeded ${maxShots} shots`)
    const view = getTargetView(board, rules)
    const shot = ai.chooseShot(view, aiRng)
    if (!inBounds(shot, rules.gridSize) || view.cells[shot.row][shot.col] !== 'unknown') {
      throw new Error(`${ai.difficulty} AI chose invalid cell ${coordKey(shot)}`)
    }
    board = receiveShot(board, shot, rules.gridSize).board
    moves.push(shot)
  }
  return { shots: moves.length, moves }
}

/** Mean shots-to-win over games seeded `firstSeed .. firstSeed + games - 1`. */
export function averageShotsToWin(ai: AIPlayer, rules: RuleSet, games: number, firstSeed = 1) {
  let total = 0
  for (let i = 0; i < games; i++) total += simulateGame(ai, rules, firstSeed + i).shots
  return total / games
}
