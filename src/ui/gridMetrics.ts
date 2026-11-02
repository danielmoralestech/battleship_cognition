import type { Coord } from '../engine/types'

export interface GridMetrics {
  /** Distance between the starts of adjacent cells, in CSS pixels. */
  pitch: number
  cellSize: number
  cellAt: (x: number, y: number) => Coord | null
}

/** Measures a rendered Grid so viewport points can be mapped to cells. */
export function measureGrid(gridEl: HTMLElement, size: number): GridMetrics | null {
  const first = gridEl.querySelector('[data-row="0"][data-col="0"]')
  const last = gridEl.querySelector(`[data-row="${size - 1}"][data-col="${size - 1}"]`)
  if (!first || !last) return null
  const a = first.getBoundingClientRect()
  const b = last.getBoundingClientRect()
  const pitch = size > 1 ? (b.left - a.left) / (size - 1) : a.width
  return {
    pitch,
    cellSize: a.width,
    cellAt: (x, y) => {
      const col = Math.floor((x - a.left) / pitch)
      const row = Math.floor((y - a.top) / pitch)
      return row >= 0 && col >= 0 && row < size && col < size ? { row, col } : null
    },
  }
}
