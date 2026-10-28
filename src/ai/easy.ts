import { randomUnknownCell } from './shared'
import type { AIPlayer } from './types'

/** Fires at a uniformly random unknown cell. */
export const easyAI: AIPlayer = {
  difficulty: 'easy',
  chooseShot: randomUnknownCell,
}
