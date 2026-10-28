import type { Difficulty, GameState } from '../engine/types'

const GAME_KEY = 'battleship:game:v1'
const STATS_KEY = 'battleship:stats:v1'

export interface Record {
  wins: number
  losses: number
}

export type Stats = { [D in Difficulty]: Record }

const emptyStats = (): Stats => ({
  easy: { wins: 0, losses: 0 },
  medium: { wins: 0, losses: 0 },
  hard: { wins: 0, losses: 0 },
})

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode, quota); persistence is best-effort.
  }
}

export function loadGame(): GameState | null {
  const state = read<GameState>(GAME_KEY)
  const valid =
    state &&
    ['setup', 'playing', 'gameOver'].includes(state.phase) &&
    state.boards?.human?.ships &&
    state.boards?.ai?.shots &&
    Array.isArray(state.log)
  return valid ? state : null
}

export const saveGame = (state: GameState) => write(GAME_KEY, state)

export function loadStats(): Stats {
  return { ...emptyStats(), ...read<Stats>(STATS_KEY) }
}

export function recordResult(difficulty: Difficulty, won: boolean): Stats {
  const stats = loadStats()
  const current = stats[difficulty]
  const next: Stats = {
    ...stats,
    [difficulty]: won
      ? { ...current, wins: current.wins + 1 }
      : { ...current, losses: current.losses + 1 },
  }
  write(STATS_KEY, next)
  return next
}
