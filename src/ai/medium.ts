import { coordKey } from '../engine/board'
import type { Coord, Rng, TargetView } from '../engine/types'
import type { AIPlayer } from './types'
import { cellAt, cellsInState, isUnknown, ORTHOGONAL_STEPS, pickRandom } from './shared'

interface HitLine {
  length: number
  openEnds: Coord[]
}

/** Maximal runs of 2+ collinear hits, with the unknown cells just past each end. */
function findHitLines(view: TargetView, hits: Coord[]): HitLine[] {
  const isHit = (row: number, col: number) => cellAt(view, row, col) === 'hit'
  const lines: HitLine[] = []
  for (const { row, col } of hits) {
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ]) {
      if (isHit(row - dr, col - dc) || !isHit(row + dr, col + dc)) continue
      let length = 2
      while (isHit(row + dr * length, col + dc * length)) length++
      const ends = [
        { row: row - dr, col: col - dc },
        { row: row + dr * length, col: col + dc * length },
      ]
      lines.push({ length, openEnds: ends.filter((c) => isUnknown(view, c.row, c.col)) })
    }
  }
  return lines.sort((a, b) => b.length - a.length)
}

function targetCandidates(view: TargetView, hits: Coord[]): Coord[] {
  const line = findHitLines(view, hits).find((l) => l.openEnds.length > 0)
  if (line) return line.openEnds

  // No extendable line: either isolated hits, or lines capped on both ends
  // (adjacent ships), so probe around every unresolved hit.
  const seen = new Set<string>()
  const neighbors: Coord[] = []
  for (const hit of hits) {
    for (const step of ORTHOGONAL_STEPS) {
      const c = { row: hit.row + step.row, col: hit.col + step.col }
      if (!isUnknown(view, c.row, c.col) || seen.has(coordKey(c))) continue
      seen.add(coordKey(c))
      neighbors.push(c)
    }
  }
  return neighbors
}

function huntCandidates(view: TargetView): Coord[] {
  const unknown = cellsInState(view, 'unknown')
  if (view.remainingShips.length === 0) return unknown
  const spacing = Math.min(...view.remainingShips.map((s) => s.length))
  const onParity = unknown.filter((c) => (c.row + c.col) % spacing === 0)
  return onParity.length > 0 ? onParity : unknown
}

/** Hunt/target: parity-pattern search, then work outward from unresolved hits. */
export function chooseMediumShot(view: TargetView, rng: Rng): Coord {
  const hits = cellsInState(view, 'hit')
  const targets = hits.length > 0 ? targetCandidates(view, hits) : []
  return pickRandom(targets.length > 0 ? targets : huntCandidates(view), rng)
}

export const mediumAI: AIPlayer = {
  difficulty: 'medium',
  chooseShot: chooseMediumShot,
}
