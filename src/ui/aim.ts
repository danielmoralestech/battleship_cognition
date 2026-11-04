import { useState } from 'react'
import { sameCoord } from '../engine/board'
import { canFire } from '../engine/game'
import type { Coord, GameState } from '../engine/types'
import { useSettings } from './settings'

export interface Aim {
  enabled: boolean
  aimed: Coord | null
  /** Tap/activation on an enemy cell: fires at once, or aims first when "Aim before firing" is on. */
  select: (coord: Coord) => void
  fireAimed: () => void
}

export function useAim(state: GameState, fire: (coord: Coord) => void): Aim {
  const { settings } = useSettings()
  const enabled = settings.aimToFire
  // Tagged with the shot count so an aim never outlives the turn it was made in.
  const [raw, setRaw] = useState<{ coord: Coord; shot: number } | null>(null)
  // Switching the setting off drops the aim, so switching it back on starts fresh.
  if (!enabled && raw) setRaw(null)
  const humanTurn = state.phase === 'playing' && state.turn === 'human'
  const aimed =
    enabled &&
    raw &&
    raw.shot === state.log.length &&
    humanTurn &&
    canFire(state, 'human', raw.coord)
      ? raw.coord
      : null

  const shoot = (coord: Coord) => {
    setRaw(null)
    fire(coord)
  }
  return {
    enabled,
    aimed,
    select: (coord) => {
      if (!humanTurn || !canFire(state, 'human', coord)) return
      if (!enabled || (aimed && sameCoord(aimed, coord))) shoot(coord)
      else setRaw({ coord, shot: state.log.length })
    },
    fireAimed: () => aimed && shoot(aimed),
  }
}
