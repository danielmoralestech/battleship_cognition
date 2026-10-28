import type { Difficulty } from '../engine/types'
import { easyAI } from './easy'
import { hardAI } from './hard'
import { mediumAI } from './medium'
import type { AIPlayer } from './types'

const AI_BY_DIFFICULTY: Record<Difficulty, AIPlayer> = {
  easy: easyAI,
  medium: mediumAI,
  hard: hardAI,
}

/** AIs are stateless, so a shared instance per difficulty is safe. */
export function createAI(difficulty: Difficulty): AIPlayer {
  return AI_BY_DIFFICULTY[difficulty]
}

export type { AIPlayer } from './types'
