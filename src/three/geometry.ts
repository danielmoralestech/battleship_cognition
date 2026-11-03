import type { BattleLayout } from '../hooks/useMediaQuery'
import type { Coord, PlacedShip, PlayerId } from '../engine/types'

/** World units: one board cell is 1×1, boards lie on the y = 0 water plane. */
export interface BoardPlacement {
  x: number
  z: number
}

const BOARD_SPACING = 6.75

/** Phones upright: your fleet in the foreground, enemy across the water. Otherwise side by side. */
export function boardPlacements(layout: BattleLayout): Record<PlayerId, BoardPlacement> {
  return layout === 'portrait'
    ? { ai: { x: 0, z: -BOARD_SPACING }, human: { x: 0, z: BOARD_SPACING } }
    : { ai: { x: -BOARD_SPACING, z: 0 }, human: { x: BOARD_SPACING, z: 0 } }
}

/** Centre of a cell in world space. Row 0 is the far edge (top of the screen), as in the 2D grid. */
export function cellToWorld(board: BoardPlacement, coord: Coord, size: number): [number, number] {
  const half = size / 2
  return [board.x + coord.col - half + 0.5, board.z + coord.row - half + 0.5]
}

/** Inverse of `cellToWorld` for a raycast hit; null when outside the board. */
export function worldToCell(
  board: BoardPlacement,
  x: number,
  z: number,
  size: number,
): Coord | null {
  const half = size / 2
  const col = Math.floor(x - board.x + half)
  const row = Math.floor(z - board.z + half)
  if (row < 0 || col < 0 || row >= size || col >= size) return null
  return { row, col }
}

/** Centre of a ship (world x/z) and its yaw: bow points +x when horizontal, +z when vertical. */
export function shipTransform(
  board: BoardPlacement,
  ship: PlacedShip,
  size: number,
): { x: number; z: number; yaw: number } {
  const [x0, z0] = cellToWorld(board, ship.origin, size)
  const offset = (ship.length - 1) / 2
  return ship.orientation === 'horizontal'
    ? { x: x0 + offset, z: z0, yaw: 0 }
    : { x: x0, z: z0 + offset, yaw: -Math.PI / 2 }
}

export interface Framing {
  /** World-space rectangle on the water to keep in view. */
  centerX: number
  centerZ: number
  width: number
  depth: number
  /** Camera elevation above the horizon, degrees. */
  elevation: number
}

/**
 * Distance from the target at which a perspective camera sees the whole rectangle.
 * `heightFraction` is the share of the canvas height left free by overlaid HUD panels.
 */
export function framingDistance(
  framing: Framing,
  aspect: number,
  fovDeg: number,
  heightFraction = 1,
): number {
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360)
  const el = (framing.elevation * Math.PI) / 180
  // The near edge of the rectangle is closer to the camera, so it projects larger: pad for it.
  const projectedDepth = framing.depth * Math.sin(el) * 1.15
  const byHeight = projectedDepth / 2 / (tanHalf * Math.max(heightFraction, 0.2))
  const byWidth = (framing.width * 1.22) / 2 / (tanHalf * aspect)
  return Math.max(byHeight, byWidth)
}

/** Camera position for a framing: behind (+z) and above the rectangle centre. */
export function cameraPosition(framing: Framing, distance: number): [number, number, number] {
  const el = (framing.elevation * Math.PI) / 180
  return [framing.centerX, distance * Math.sin(el), framing.centerZ + distance * Math.cos(el)]
}

export function framingFor(
  layout: BattleLayout,
  focus: PlayerId,
  boards: Record<PlayerId, BoardPlacement>,
  size: number,
): Framing {
  if (layout === 'portrait') {
    const b = boards[focus]
    return { centerX: b.x, centerZ: b.z, width: size + 0.6, depth: size + 0.6, elevation: 50 }
  }
  const midX = (boards.ai.x + boards.human.x) / 2
  const span = Math.abs(boards.ai.x - boards.human.x) + size + 0.6
  return { centerX: midX, centerZ: 0, width: span, depth: size + 0.6, elevation: 52 }
}
