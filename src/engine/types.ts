export type ShipType = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer'

export interface Coord {
  row: number
  col: number
}

/** String form of a Coord, `"row,col"`, used as a record key. */
export type CoordKey = string

export type Orientation = 'horizontal' | 'vertical'

export interface ShipSpec {
  type: ShipType
  name: string
  length: number
}

export interface RuleSet {
  gridSize: number
  fleet: ShipSpec[]
  allowTouching: boolean
  announceSinks: boolean
  extraShotOnHit: boolean
}

export interface PlacedShip {
  type: ShipType
  origin: Coord
  orientation: Orientation
  length: number
}

export type CellShot = 'hit' | 'miss'

export interface Board {
  ships: PlacedShip[]
  shots: Record<CoordKey, CellShot>
}

export type ShotResult = 'miss' | 'hit' | 'sunk'

export interface ShotOutcome {
  result: ShotResult
  sunkShip?: ShipType
}

/** What a shooter can legitimately know about the opponent's board. */
export type TargetCell = 'unknown' | 'miss' | 'hit' | 'sunk'

export interface SunkShipInfo {
  type: ShipType
  cells: Coord[]
}

export interface TargetView {
  gridSize: number
  /** cells[row][col] */
  cells: TargetCell[][]
  /** Ships not yet known to be sunk. */
  remainingShips: ShipSpec[]
  sunkShips: SunkShipInfo[]
}

export type PlayerId = 'human' | 'ai'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type GamePhase = 'setup' | 'playing' | 'gameOver'

export interface ShotEvent {
  id: number
  by: PlayerId
  coord: Coord
  result: ShotResult
  sunkShip?: ShipType
}

export interface GameState {
  phase: GamePhase
  rules: RuleSet
  difficulty: Difficulty
  turn: PlayerId
  /** boards[p] is the board owned by player p (their ships + shots received). */
  boards: Record<PlayerId, Board>
  log: ShotEvent[]
  winner: PlayerId | null
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number
}
