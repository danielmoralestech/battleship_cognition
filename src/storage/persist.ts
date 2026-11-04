import type { Difficulty, GameState } from '../engine/types'
import { DEFAULT_FLEET_COLORS, isTeamColor, type FleetColors } from '../ui/teamColors'

const GAME_KEY = 'battleship:game:v1'
const STATS_KEY = 'battleship:stats:v1'
const VIEW_KEY = 'battleship:view:v1'
const COLORS_KEY = 'battleship:colors:v1'
const SETTINGS_KEY = 'battleship:settings:v1'

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

export const loadView = (): '2d' | '3d' | null => {
  const view = read<string>(VIEW_KEY)
  return view === '2d' || view === '3d' ? view : null
}

export const saveView = (view: '2d' | '3d') => write(VIEW_KEY, view)

export function loadColors(): FleetColors {
  const saved = read<Partial<FleetColors>>(COLORS_KEY)
  return {
    human: isTeamColor(saved?.human) ? saved.human : DEFAULT_FLEET_COLORS.human,
    ai: isTeamColor(saved?.ai) ? saved.ai : DEFAULT_FLEET_COLORS.ai,
  }
}

export const saveColors = (colors: FleetColors) => write(COLORS_KEY, colors)

export interface Settings {
  sound: boolean
  /** First tap aims, a second tap (or the Fire button) fires. */
  aimToFire: boolean
}

export const DEFAULT_SETTINGS: Settings = { sound: true, aimToFire: false }

export function loadSettings(): Settings {
  const saved = read<Partial<Settings>>(SETTINGS_KEY)
  return {
    sound: typeof saved?.sound === 'boolean' ? saved.sound : DEFAULT_SETTINGS.sound,
    aimToFire: typeof saved?.aimToFire === 'boolean' ? saved.aimToFire : DEFAULT_SETTINGS.aimToFire,
  }
}

export const saveSettings = (settings: Settings) => write(SETTINGS_KEY, settings)

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
