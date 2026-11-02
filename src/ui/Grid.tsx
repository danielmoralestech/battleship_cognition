import type { PointerEvent, Ref } from 'react'
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
  /** Original spot of a ship that is currently being dragged. */
  lifted?: boolean
}

interface GridProps {
  size: number
  label: string
  getCell: (coord: Coord) => CellView
  onCellClick?: (coord: Coord) => void
  onCellHover?: (coord: Coord | null) => void
  onCellContextMenu?: (coord: Coord) => void
  onCellPointerDown?: (coord: Coord, e: PointerEvent) => void
  /** Disables browser touch panning/zooming on the board so touches can drag ships. */
  touchDrag?: boolean
  gridRef?: Ref<HTMLDivElement>
  dimmed?: boolean
  /** Small read-only overview: no coordinate labels or interactive cells. */
  mini?: boolean
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function Grid({
  size,
  label,
  getCell,
  onCellClick,
  onCellHover,
  onCellContextMenu,
  onCellPointerDown,
  touchDrag,
  gridRef,
  dimmed,
  mini,
}: GridProps) {
  const indices = Array.from({ length: size }, (_, i) => i)
  if (mini) return <MiniGrid size={size} label={label} getCell={getCell} />
  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={label}
      className={`mx-auto grid w-full max-w-[26rem] select-none gap-[2px] transition-opacity ${dimmed ? 'opacity-60' : ''} ${touchDrag ? 'touch-none [-webkit-touch-callout:none]' : ''}`}
      style={{ gridTemplateColumns: `1.25rem repeat(${size}, minmax(0, 1fr))` }}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onCellHover?.(null)}
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
                data-row={row}
                data-col={col}
                disabled={!cell.clickable && !cell.draggable}
                onClick={() => onCellClick?.(coord)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onCellHover?.(coord)}
                onPointerDown={(e) => onCellPointerDown?.(coord, e)}
                onContextMenu={(e) => {
                  if (!onCellContextMenu) return
                  e.preventDefault()
                  onCellContextMenu(coord)
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

function MiniGrid({ size, label, getCell }: Pick<GridProps, 'size' | 'label' | 'getCell'>) {
  const indices = Array.from({ length: size }, (_, i) => i)
  return (
    <div
      role="img"
      aria-label={label}
      className="grid w-full gap-px"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {indices.flatMap((row) =>
        indices.map((col) => {
          const coord = { row, col }
          const cell = getCell(coord)
          const fill = cell.ship
            ? `${SHIP_COLORS[cell.ship]} ${cell.shot === 'sunk' ? 'brightness-50' : ''}`
            : 'bg-sky-900/70'
          return (
            <span
              key={`${row}-${col}`}
              data-coord={coordLabel(coord)}
              data-shot={cell.shot ?? ''}
              className={`relative aspect-square rounded-[1px] ${fill}`}
            >
              {cell.shot && <ShotMarker result={cell.shot} animate={!!cell.animate} />}
            </span>
          )
        }),
      )}
    </div>
  )
}

function cellClasses(cell: CellView): string {
  const base =
    'relative aspect-square rounded-[3px] transition-colors disabled:cursor-default focus-visible:outline-2 focus-visible:outline-amber-300'
  let fill = 'bg-sky-900/70'
  if (cell.ship) fill = `${SHIP_COLORS[cell.ship]} ${cell.shot === 'sunk' ? 'brightness-50' : ''}`
  if (cell.lifted) fill = `${fill} opacity-40`
  if (cell.preview === 'valid') fill = 'bg-emerald-400/70'
  if (cell.preview === 'invalid') fill = 'bg-red-500/60'
  let interactive = ''
  if (cell.preview) interactive = 'cursor-pointer'
  else if (cell.draggable) interactive = 'cursor-grab'
  else if (cell.clickable)
    interactive = 'cursor-crosshair hover:bg-sky-600 hover:ring-2 hover:ring-amber-300/70'
  return `${base} ${fill} ${interactive}`
}
