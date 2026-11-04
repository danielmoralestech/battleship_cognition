import { createContext, useContext } from 'react'
import type { PlayerId } from '../engine/types'

/** Fleet colors, shown as accents on the ship art. Purple and grey are a shade darker for contrast. */
export const TEAM_COLORS = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#facc15',
  orange: '#f97316',
  green: '#22c55e',
  teal: '#14b8a6',
  purple: '#7e22ce',
  black: '#0b0b0f',
  white: '#f8fafc',
  grey: '#4b5563',
} as const

export type TeamColor = keyof typeof TEAM_COLORS
export type FleetColors = Record<PlayerId, TeamColor>

export const TEAM_COLOR_NAMES = Object.keys(TEAM_COLORS) as TeamColor[]
export const DEFAULT_FLEET_COLORS: FleetColors = { human: 'blue', ai: 'red' }

export const isTeamColor = (value: unknown): value is TeamColor =>
  typeof value === 'string' && value in TEAM_COLORS

export interface FleetColorsApi {
  colors: FleetColors
  setColor: (player: PlayerId, color: TeamColor) => void
}

export const FleetColorsContext = createContext<FleetColorsApi>({
  colors: DEFAULT_FLEET_COLORS,
  setColor: () => {},
})

export const useFleetColors = () => useContext(FleetColorsContext)

/** Hex accent color for a player's fleet. */
export const useTeamHex = () => {
  const { colors } = useFleetColors()
  return (player: PlayerId) => TEAM_COLORS[colors[player]]
}
