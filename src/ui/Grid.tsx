import type { PointerEvent, Ref } from 'react'
import { coordLabel } from '../engine/board'
import type { Coord, ShipType, ShotResult } from '../engine/types'
import { ShotMarker } from '../effects'
import { ShipLayer, type BoardShip } from './ShipSprite'

export interface CellView {
  ship?: ShipType
  shot?: ShotResult
  preview?: 'valid' | 'invalid'
  animate?: boolean
  clickable?: boolean
  /** Crosshair for "Aim before firing". */
  aimed?: boolean
  draggable?: boolean
}

interface GridProps {
  size: number
  label: string
  getCell: (coord: Coord) => CellView
  /** Ships drawn as sprites over the cells. */
  ships?: BoardShip[]
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
  ships,
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
  if (mini) return <MiniGrid size={size} label={label} getCell={getCell} ships={ships} />
  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={label}
      className={`ocean relative isolate mx-auto grid w-full max-w-[26rem] select-none gap-[2px] transition-opacity ${dimmed ? 'opacity-60' : ''} ${touchDrag ? 'touch-none [-webkit-touch-callout:none]' : ''}`}
      style={{ gridTemplateColumns: `1.25rem repeat(${size}, minmax(0, 1fr))` }}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onCellHover?.(null)}
    >
      <span aria-hidden="true" className="ocean-waves" />
      <span aria-hidden="true" className="ocean-swell" />
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
                aria-label={`${coordLabel(coord)}${cell.ship ? `, ${cell.ship}` : ''}${cell.shot ? `, ${cell.shot}` : ''}${cell.aimed ? ', aimed, activate again to fire' : ''}`}
                aria-selected={cell.aimed || undefined}
                data-aimed={cell.aimed || undefined}
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
                {cell.aimed && <Crosshair />}
              </button>
            )
          })}
        </div>
      ))}
      {ships && <ShipLayer ships={ships} offset={1} />}
    </div>
  )
}

function MiniGrid({
  size,
  label,
  getCell,
  ships,
}: Pick<GridProps, 'size' | 'label' | 'getCell' | 'ships'>) {
  const indices = Array.from({ length: size }, (_, i) => i)
  return (
    <div
      role="img"
      aria-label={label}
      className="relative isolate grid w-full gap-px"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {indices.flatMap((row) =>
        indices.map((col) => {
          const coord = { row, col }
          const cell = getCell(coord)
          return (
            <span
              key={`${row}-${col}`}
              data-coord={coordLabel(coord)}
              data-shot={cell.shot ?? ''}
              className="relative aspect-square rounded-[1px] bg-sky-900/70 [&>*]:z-[2]"
            >
              {cell.shot && <ShotMarker result={cell.shot} animate={!!cell.animate} lite />}
            </span>
          )
        }),
      )}
      {ships && <ShipLayer ships={ships} offset={0} simple />}
    </div>
  )
}

function Crosshair() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute inset-0 h-full w-full animate-pulse text-amber-300 drop-shadow"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 1v6M12 17v6M1 12h6M17 12h6" strokeLinecap="round" />
    </svg>
  )
}

function cellClasses(cell: CellView): string {
  const base =
    'relative aspect-square rounded-[3px] transition-colors disabled:cursor-default focus-visible:z-[3] focus-visible:outline-2 focus-visible:outline-amber-300 [&>*]:z-[2]'
  let fill = 'bg-sky-950/30 ring-1 ring-inset ring-sky-300/10'
  if (cell.preview === 'valid') fill = 'bg-emerald-400/70'
  if (cell.preview === 'invalid') fill = 'bg-red-500/60'
  let interactive = ''
  if (cell.preview) interactive = 'cursor-pointer'
  else if (cell.draggable) interactive = 'cursor-grab'
  if (cell.aimed) fill = 'bg-amber-400/25 ring-2 ring-inset ring-amber-300'
  else if (cell.clickable)
    interactive = 'cursor-crosshair hover:bg-sky-400/30 hover:ring-2 hover:ring-amber-300/70'
  return `${base} ${fill} ${interactive}`
}
