import type { CSSProperties } from 'react'
import type { PlacedShip } from '../engine/types'

/** Ogive bow pointing right, squared stern with rounded corners. */
export function hullPath(x0: number, x1: number, top: number, bot: number, bow: number, r: number) {
  const mid = (top + bot) / 2
  const half = (bot - top) / 2
  const xb = x1 - bow
  return [
    `M${x0 + r} ${top}`,
    `L${xb} ${top}`,
    `C${xb + bow * 0.6} ${top} ${x1 - bow * 0.12} ${mid - half * 0.22} ${x1} ${mid}`,
    `C${x1 - bow * 0.12} ${mid + half * 0.22} ${xb + bow * 0.6} ${bot} ${xb} ${bot}`,
    `L${x0 + r} ${bot}`,
    `Q${x0} ${bot} ${x0} ${bot - r}`,
    `L${x0} ${top + r}`,
    `Q${x0} ${top} ${x0 + r} ${top}`,
    'Z',
  ].join(' ')
}

/** CSS grid placement of a ship; `offset` skips header rows/columns. */
export function shipGridArea(ship: PlacedShip, offset = 0): CSSProperties {
  const horizontal = ship.orientation === 'horizontal'
  return {
    gridRow: `${ship.origin.row + 1 + offset} / span ${horizontal ? 1 : ship.length}`,
    gridColumn: `${ship.origin.col + 1 + offset} / span ${horizontal ? ship.length : 1}`,
  }
}
