import type {
  Board,
  Coord,
  CoordKey,
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
