import type { Coord, Difficulty, Rng, TargetView } from '../engine/types'

/**
 * AI opponents are stateless: every decision is derived from the TargetView,
 * so a saved game can be resumed without restoring AI memory.
 */
export interface AIPlayer {
  readonly difficulty: Difficulty
  /** Must return an in-bounds cell whose TargetView state is 'unknown'. */
  chooseShot(view: TargetView, rng: Rng): Coord
}
