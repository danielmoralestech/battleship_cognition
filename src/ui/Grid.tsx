import type { DragEvent } from 'react'
import { coordLabel } from '../engine/board'
import type { Coord, ShipType, ShotResult } from '../engine/types'
import { ShotMarker } from '../effects'
import { SHIP_COLORS } from './ships'

export interface CellView {
  ship?: ShipType
  shot?: ShotResult
  preview?: 'valid' | 'invalid'
  animate?: boolean
  clickable?: boolean
  draggable?: boolean
}

interface GridProps {
  size: number
  label: string
  getCell: (coord: Coord) => CellView
  onCellClick?: (coord: Coord) => void
  onCellHover?: (coord: Coord | null) => void
  onCellContextMenu?: (coord: Coord) => void
  onCellDragStart?: (coord: Coord, e: DragEvent) => void
  onCellDrop?: (coord: Coord) => void
  dimmed?: boolean
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function Grid({
  size,
  label,
  getCell,
  onCellClick,
  onCellHover,
  onCellContextMenu,
  onCellDragStart,
  onCellDrop,
  dimmed,
}: GridProps) {
  const indices = Array.from({ length: size }, (_, i) => i)
  return (
    <div
      role="grid"
      aria-label={label}
      className={`grid w-full max-w-[26rem] select-none gap-[2px] transition-opacity ${dimmed ? 'opacity-60' : ''}`}
      style={{ gridTemplateColumns: `1.25rem repeat(${size}, minmax(0, 1fr))` }}
      onMouseLeave={() => onCellHover?.(null)}
    >
      <span />
      {indices.map((c) => (
        <span key={c} className="text-center text-xs font-semibold text-sky-300/70">
          {COLUMNS[c]}
        </span>
      ))}
      {indices.map((row) => (
        <div key={row} role="row" className="contents">
          <span className="flex items-center justify-center text-xs font-semibold text-sky-300/70">
            {row + 1}
          </span>
          {indices.map((col) => {
            const coord = { row, col }
            const cell = getCell(coord)
            return (
              <button
                key={col}
                type="button"
                role="gridcell"
                aria-label={`${coordLabel(coord)}${cell.ship ? `, ${cell.ship}` : ''}${cell.shot ? `, ${cell.shot}` : ''}`}
                data-coord={coordLabel(coord)}
                data-shot={cell.shot ?? ''}
                disabled={!cell.clickable && !cell.draggable}
                draggable={cell.draggable}
                onClick={() => onCellClick?.(coord)}
                onMouseEnter={() => onCellHover?.(coord)}
                onContextMenu={(e) => {
                  if (!onCellContextMenu) return
                  e.preventDefault()
                  onCellContextMenu(coord)
                }}
                onDragStart={(e) => onCellDragStart?.(coord, e)}
                onDragOver={(e) => {
                  if (!onCellDrop) return
                  e.preventDefault()
                  onCellHover?.(coord)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  onCellDrop?.(coord)
                }}
                className={cellClasses(cell)}
              >
                {cell.shot && <ShotMarker result={cell.shot} animate={!!cell.animate} />}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function cellClasses(cell: CellView): string {
  const base =
    'relative aspect-square rounded-[3px] transition-colors disabled:cursor-default focus-visible:outline-2 focus-visible:outline-amber-300'
  let fill = 'bg-sky-900/70'
  if (cell.ship) fill = `${SHIP_COLORS[cell.ship]} ${cell.shot === 'sunk' ? 'brightness-50' : ''}`
  if (cell.preview === 'valid') fill = 'bg-emerald-400/70'
  if (cell.preview === 'invalid') fill = 'bg-red-500/60'
  const interactive = cell.clickable
    ? 'cursor-crosshair hover:bg-sky-600 hover:ring-2 hover:ring-amber-300/70'
    : cell.draggable
      ? 'cursor-grab'
      : ''
  return `${base} ${fill} ${interactive}`
}
