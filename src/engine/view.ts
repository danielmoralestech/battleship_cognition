import { coordKey, isShipSunk, shipCells } from './board'
import type { Board, RuleSet, SunkShipInfo, TargetCell, TargetView } from './types'

/** The opponent's board as seen by the shooter: no hidden ship positions are revealed. */
export function getTargetView(board: Board, rules: RuleSet): TargetView {
  const size = rules.gridSize
  const cells: TargetCell[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const shot = board.shots[coordKey({ row, col })]
      return shot ?? 'unknown'
    }),
  )
  const sunkShips: SunkShipInfo[] = []
  if (rules.announceSinks) {
    for (const ship of board.ships) {
      if (!isShipSunk(board, ship)) continue
      const shipCoords = shipCells(ship)
      sunkShips.push({ type: ship.type, cells: shipCoords })
      for (const c of shipCoords) cells[c.row][c.col] = 'sunk'
    }
  }
  const sunkTypes = new Set(sunkShips.map((s) => s.type))
  return {
    gridSize: size,
    cells,
    remainingShips: rules.fleet.filter((s) => !sunkTypes.has(s.type)),
    sunkShips,
  }
}
