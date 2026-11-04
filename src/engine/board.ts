import type {
  Board,
  Coord,
  CoordKey,
  Facing,
  Orientation,
  PlacedShip,
  Rng,
  RuleSet,
  ShotOutcome,
} from './types'

export const coordKey = (c: Coord): CoordKey => `${c.row},${c.col}`

export const parseCoordKey = (key: CoordKey): Coord => {
  const [row, col] = key.split(',').map(Number)
  return { row, col }
}

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** Human label such as "C7" (column letter + 1-based row). */
export const coordLabel = (c: Coord): string => `${COLUMN_LETTERS[c.col]}${c.row + 1}`

export const sameCoord = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col

export const inBounds = (c: Coord, size: number) =>
  c.row >= 0 && c.col >= 0 && c.row < size && c.col < size

const FACINGS: Facing[] = ['north', 'east', 'south', 'west']

/** 1 turns clockwise, -1 anticlockwise. */
export type Turn = 1 | -1

export const facingOf = (ship: Pick<PlacedShip, 'orientation' | 'facing'>): Facing =>
  ship.facing ?? (ship.orientation === 'horizontal' ? 'east' : 'north')

export const orientationOf = (facing: Facing): Orientation =>
  facing === 'east' || facing === 'west' ? 'horizontal' : 'vertical'

export const turnFacing = (facing: Facing, turn: Turn): Facing =>
  FACINGS[(FACINGS.indexOf(facing) + turn + 4) % 4]

/** Index of the stern segment, counted from the ship's origin. */
export const sternIndex = (facing: Facing, length: number) =>
  facing === 'east' || facing === 'south' ? 0 : length - 1

/**
 * Turns a ship 90° about its `grabIndex`-th segment. Returns the new shape and the
 * index that segment has after the turn (cells are always counted from the origin).
 */
export function turnShape(
  ship: Pick<PlacedShip, 'length' | 'orientation' | 'facing'>,
  grabIndex: number,
  turn: Turn,
): { orientation: Orientation; facing: Facing; grabIndex: number } {
  const facing = turnFacing(facingOf(ship), turn)
  // Rotating flips the order of the cells when vertical turns clockwise or horizontal turns back.
  const flips = (turn === 1) === (ship.orientation === 'vertical')
  return {
    orientation: orientationOf(facing),
    facing,
    grabIndex: flips ? ship.length - 1 - grabIndex : grabIndex,
  }
}

export function shipCells(ship: Pick<PlacedShip, 'origin' | 'orientation' | 'length'>): Coord[] {
  const { origin, orientation, length } = ship
  return Array.from({ length }, (_, i) =>
    orientation === 'horizontal'
      ? { row: origin.row, col: origin.col + i }
      : { row: origin.row + i, col: origin.col },
  )
}

export type PlacementError =
  'out_of_bounds' | 'overlap' | 'touching' | 'unknown_type' | 'wrong_length'

/**
 * Checks whether `candidate` can be added to `others` (ships of the same type in
 * `others` are ignored, so this also validates moving an already-placed ship).
 */
export function validatePlacement(
  others: PlacedShip[],
  candidate: PlacedShip,
  rules: RuleSet,
): PlacementError | null {
  const spec = rules.fleet.find((s) => s.type === candidate.type)
  if (!spec) return 'unknown_type'
  if (spec.length !== candidate.length) return 'wrong_length'
  const cells = shipCells(candidate)
  if (!cells.every((c) => inBounds(c, rules.gridSize))) return 'out_of_bounds'

  const occupied = new Set<CoordKey>()
  for (const ship of others) {
    if (ship.type === candidate.type) continue
    for (const c of shipCells(ship)) occupied.add(coordKey(c))
  }
  if (cells.some((c) => occupied.has(coordKey(c)))) return 'overlap'

  if (!rules.allowTouching) {
    const touches = cells.some((c) => {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (occupied.has(coordKey({ row: c.row + dr, col: c.col + dc }))) return true
      return false
    })
    if (touches) return 'touching'
  }
  return null
}

export function upsertShip(ships: PlacedShip[], ship: PlacedShip): PlacedShip[] {
  return [...ships.filter((s) => s.type !== ship.type), ship]
}

/**
 * Places a ship so its `grabIndex`-th segment sits on `cell`, shifted as little as
 * needed to keep it on the board.
 */
export function anchorShip(
  ship: Pick<PlacedShip, 'type' | 'length' | 'orientation' | 'facing'>,
  cell: Coord,
  grabIndex: number,
  gridSize: number,
): PlacedShip {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max))
  const horizontal = ship.orientation === 'horizontal'
  const origin = {
    row: clamp(
      horizontal ? cell.row : cell.row - grabIndex,
      gridSize - (horizontal ? 1 : ship.length),
    ),
    col: clamp(
      horizontal ? cell.col - grabIndex : cell.col,
      gridSize - (horizontal ? ship.length : 1),
    ),
  }
  const placed: PlacedShip = {
    type: ship.type,
    length: ship.length,
    orientation: ship.orientation,
    origin,
  }
  if (ship.facing) placed.facing = ship.facing
  return placed
}

/** The valid placement of `candidate`'s ship (same orientation) closest to its origin. */
export function nearestValidPlacement(
  others: PlacedShip[],
  candidate: PlacedShip,
  rules: RuleSet,
): PlacedShip | null {
  let best: PlacedShip | null = null
  let bestDistance = Infinity
  for (let row = 0; row < rules.gridSize; row++) {
    for (let col = 0; col < rules.gridSize; col++) {
      const distance = Math.abs(row - candidate.origin.row) + Math.abs(col - candidate.origin.col)
      if (distance >= bestDistance) continue
      const ship = { ...candidate, origin: { row, col } }
      if (validatePlacement(others, ship, rules) === null) {
        best = ship
        bestDistance = distance
      }
    }
  }
  return best
}

/**
 * Rotates a placed ship 90° (`turn`: 1 clockwise, -1 anticlockwise) around `pivot` (one of its cells), nudging it to the
 * nearest free spot if needed. Returns null when it cannot fit rotated anywhere.
 */
export function rotateShip(
  others: PlacedShip[],
  ship: PlacedShip,
  pivot: Coord,
  rules: RuleSet,
  turn: Turn = 1,
): PlacedShip | null {
  const grabIndex = Math.max(
    0,
    shipCells(ship).findIndex((c) => sameCoord(c, pivot)),
  )
  const turned = turnShape(ship, grabIndex, turn)
  const rotated = anchorShip({ ...ship, ...turned }, pivot, turned.grabIndex, rules.gridSize)
  if (validatePlacement(others, rotated, rules) === null) return rotated
  return nearestValidPlacement(others, rotated, rules)
}

export function isFleetComplete(ships: PlacedShip[], rules: RuleSet): boolean {
  return rules.fleet.every((spec) => ships.some((s) => s.type === spec.type))
}

export function randomPlacement(rules: RuleSet, rng: Rng): PlacedShip[] {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const ships: PlacedShip[] = []
    let failed = false
    for (const spec of rules.fleet) {
      let placed = false
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const orientation: Orientation = rng.next() < 0.5 ? 'horizontal' : 'vertical'
        const maxRow =
          orientation === 'vertical' ? rules.gridSize - spec.length : rules.gridSize - 1
        const maxCol =
          orientation === 'horizontal' ? rules.gridSize - spec.length : rules.gridSize - 1
        const candidate: PlacedShip = {
          type: spec.type,
          length: spec.length,
          orientation,
          origin: { row: rng.int(maxRow + 1), col: rng.int(maxCol + 1) },
        }
        if (validatePlacement(ships, candidate, rules) === null) {
          ships.push(candidate)
          placed = true
        }
      }
      if (!placed) {
        failed = true
        break
      }
    }
    if (!failed) return ships
  }
  throw new Error('Could not generate a random fleet placement')
}

export const createBoard = (ships: PlacedShip[] = []): Board => ({ ships, shots: {} })

export function shipAt(board: Board, c: Coord): PlacedShip | undefined {
  return board.ships.find((s) => shipCells(s).some((cell) => sameCoord(cell, c)))
}

export function isShipSunk(board: Board, ship: PlacedShip): boolean {
  return shipCells(ship).every((c) => board.shots[coordKey(c)] === 'hit')
}

export function allShipsSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every((s) => isShipSunk(board, s))
}

export const hasBeenShot = (board: Board, c: Coord) => coordKey(c) in board.shots

/** Applies a shot to `board`. Throws on out-of-bounds or repeated shots. */
export function receiveShot(
  board: Board,
  c: Coord,
  gridSize: number,
): { board: Board } & ShotOutcome {
  if (!inBounds(c, gridSize)) throw new Error(`Shot out of bounds: ${coordKey(c)}`)
  if (hasBeenShot(board, c)) throw new Error(`Cell already shot: ${coordKey(c)}`)
  const ship = shipAt(board, c)
  const next: Board = { ...board, shots: { ...board.shots, [coordKey(c)]: ship ? 'hit' : 'miss' } }
  if (!ship) return { board: next, result: 'miss' }
  if (isShipSunk(next, ship)) return { board: next, result: 'sunk', sunkShip: ship.type }
  return { board: next, result: 'hit' }
}
