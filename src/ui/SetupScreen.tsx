import { useAnimate } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  anchorShip,
  facingOf,
  isFleetComplete,
  orientationOf,
  rotateShip,
  sameCoord,
  shipAt,
  shipCells,
  sternIndex,
  turnFacing,
  turnShape,
  validatePlacement,
  type Turn,
} from '../engine/board'
import type { Coord, Difficulty, Facing, Orientation, PlacedShip, ShipType } from '../engine/types'
import type { GameApi } from '../hooks/useGame'
import { Grid, type CellView } from './Grid'
import { measureGrid } from './gridMetrics'
import { ShipSprite, type BoardShip } from './ShipSprite'
import { TEAM_COLOR_NAMES, TEAM_COLORS, useFleetColors, type TeamColor } from './teamColors'
import { useBattleLayout, useMediaQuery } from '../hooks/useMediaQuery'

const DIFFICULTY_INFO: Record<Difficulty, string> = {
  easy: 'Fires at random.',
  medium: 'Hunts in a checkerboard, then chases hits.',
  hard: 'Calculates where your ships most likely are.',
}

/** Pointer travel (px) before a press becomes a drag instead of a tap. */
const DRAG_THRESHOLD = 8
/** On touch, the dragged ship floats this many cells above the finger so it stays visible. */
const TOUCH_LIFT_CELLS = 1.25
/** Wheel travel (px) that counts as a deliberate turn of the wheel. */
const WHEEL_STEP = 30
/** A wheel gesture ends after this long without wheel events; each gesture rotates once. */
const WHEEL_GESTURE_GAP_MS = 180

interface DragSession {
  type: ShipType
  length: number
  orientation: Orientation
  facing: Facing
  grabIndex: number
  from: 'tray' | 'board'
  pointerId: number
  pointerType: string
  startX: number
  startY: number
  active: boolean
  pointerX: number
  pointerY: number
}

interface DragView {
  session: DragSession
  /** Where the dragged ship is drawn (above the finger on touch). */
  x: number
  y: number
  target: PlacedShip | null
  valid: boolean
  cellSize: number
  pitch: number
}

export function SetupScreen({ game }: { game: GameApi }) {
  const { state, placeShip, removeShip, randomizeFleet, clearFleet, setDifficulty, startGame } =
    game
  const { rules } = state
  const { colors, setColor } = useFleetColors()
  // Board beside the controls on a phone on its side, if the width leaves the board at least 12rem.
  const roomBeside = useMediaQuery('(min-width: 568px)')
  const landscape = useBattleLayout() === 'landscape' && roomBeside
  const myTeam = TEAM_COLORS[colors.human]
  const ships = state.boards.human.ships
  const firstUnplaced = rules.fleet.find((s) => !ships.some((p) => p.type === s.type))?.type ?? null

  const [selected, setSelected] = useState<ShipType | null>(firstUnplaced)
  const [facing, setFacing] = useState<Facing>('east')
  const orientation = orientationOf(facing)
  const [hover, setHover] = useState<Coord | null>(null)
  const [drag, setDragState] = useState<DragView | null>(null)
  const dragView = useRef<DragView | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const session = useRef<DragSession | null>(null)
  const suppressClick = useRef(false)
  const [boardScope, animateBoard] = useAnimate<HTMLDivElement>()

  const activeShip = selected && !ships.some((s) => s.type === selected) ? selected : null
  const selectedType = activeShip ?? firstUnplaced
  const lengthOf = (type: ShipType) => rules.fleet.find((s) => s.type === type)!.length

  const shake = useCallback(() => {
    if (boardScope.current)
      animateBoard(boardScope.current, { x: [0, -6, 6, -3, 3, 0] }, { duration: 0.3 })
  }, [animateBoard, boardScope])

  const nextUnplaced = (placed: ShipType) =>
    rules.fleet.find((s) => s.type !== placed && !ships.some((p) => p.type === s.type))?.type ??
    null

  const commit = (ship: PlacedShip) => {
    if (validatePlacement(ships, ship, rules) !== null) return false
    const wasPlaced = ships.some((s) => s.type === ship.type)
    placeShip(ship)
    if (!wasPlaced) setSelected(nextUnplaced(ship.type))
    return true
  }

  const setDrag = (view: DragView | null) => {
    dragView.current = view
    setDragState(view)
  }

  const computeDrag = (s: DragSession): DragView | null => {
    const metrics = gridRef.current && measureGrid(gridRef.current, rules.gridSize)
    if (!metrics) return null
    const x = s.pointerX
    const y = s.pointerY - (s.pointerType === 'touch' ? metrics.pitch * TOUCH_LIFT_CELLS : 0)
    const cell = metrics.cellAt(x, y)
    const target = cell ? anchorShip(s, cell, s.grabIndex, rules.gridSize) : null
    return {
      session: s,
      x,
      y,
      target,
      valid: !!target && validatePlacement(ships, target, rules) === null,
      cellSize: metrics.cellSize,
      pitch: metrics.pitch,
    }
  }

  /** Rotates the placed ship covering `coord` in place; false if the cell is empty water. */
  function rotateAt(coord: Coord, turn: Turn) {
    const ship = shipAt(state.boards.human, coord)
    if (!ship) return false
    rotatePlaced(ship, coord, turn)
    return true
  }

  // Window listeners read the latest render's values through this ref.
  const latest = useRef({ computeDrag, commit, removeShip, setDrag, rotateAt })
  useLayoutEffect(() => {
    latest.current = { computeDrag, commit, removeShip, setDrag, rotateAt }
  })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      if (!s.active) {
        if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < DRAG_THRESHOLD) return
        s.active = true
        if (s.from === 'tray') setSelected(s.type)
      }
      e.preventDefault()
      s.pointerX = e.clientX
      s.pointerY = e.clientY
      latest.current.setDrag(latest.current.computeDrag(s))
    }
    const onUp = (e: PointerEvent) => {
      const s = session.current
      if (!s || e.pointerId !== s.pointerId) return
      session.current = null
      if (!s.active) return
      // Swallow the click the browser may fire for this same gesture.
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 300)
      const { commit, removeShip, setDrag } = latest.current
      const view = dragView.current
      if (view?.target && view.valid) commit(view.target)
      else if (!view?.target && s.from === 'board') {
        removeShip(s.type)
        setSelected(s.type)
      }
      setDrag(null)
    }
    const onCancel = (e: PointerEvent) => {
      if (session.current?.pointerId !== e.pointerId) return
      session.current = null
      latest.current.setDrag(null)
    }
    const onDown = () => (suppressClick.current = false)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [])

  /** Turns the dragged ship, or else the next ship to place, 90°. */
  const turnNext = useCallback((turn: Turn) => {
    const s = session.current
    if (s?.active) {
      Object.assign(s, turnShape(s, s.grabIndex, turn))
      latest.current.setDrag(latest.current.computeDrag(s))
      return
    }
    setFacing((f) => turnFacing(f, turn))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') turnNext(e.shiftKey ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [turnNext])

  // Wheel over the board rotates: the dragged ship, else the placed ship under the cursor, else
  // the next ship's preview. Trackpads send a burst of small deltas per swipe, so one gesture
  // turns the ship once: down/right is clockwise, up/left anticlockwise. Needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    let travel = 0
    let rotated = false
    let lastEvent = 0
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      e.preventDefault()
      if (e.timeStamp - lastEvent > WHEEL_GESTURE_GAP_MS) {
        travel = 0
        rotated = false
      }
      lastEvent = e.timeStamp
      const scale =
        e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? el.clientHeight
          : e.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : 1
      travel += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * scale
      if (rotated || Math.abs(travel) < WHEEL_STEP) return
      rotated = true
      const turn: Turn = travel > 0 ? 1 : -1
      if (session.current?.active) return turnNext(turn)
      const cell = (e.target as Element | null)?.closest<HTMLElement>('[data-row][data-col]')
      const coord = cell && { row: Number(cell.dataset.row), col: Number(cell.dataset.col) }
      if (!coord || !latest.current.rotateAt(coord, turn)) turnNext(turn)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [turnNext])

  const startDrag = (
    e: ReactPointerEvent,
    ship: Pick<PlacedShip, 'type' | 'length' | 'orientation' | 'facing'>,
    grabIndex: number,
    from: DragSession['from'],
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType === 'mouse') e.preventDefault()
    session.current = {
      ...ship,
      facing: facingOf(ship),
      grabIndex,
      from,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      pointerX: e.clientX,
      pointerY: e.clientY,
    }
  }

  const clickSuppressed = () => {
    const suppressed = suppressClick.current
    suppressClick.current = false
    return suppressed
  }

  const rotatePlaced = (ship: PlacedShip, pivot: Coord, turn: Turn = 1) => {
    const rotated = rotateShip(ships, ship, pivot, rules, turn)
    if (rotated) placeShip(rotated)
    else shake()
  }

  /** The next ship with its stern on `cell`, so turning it swings it around that cell. */
  const nextShipAt = (type: ShipType, cell: Coord) => {
    const length = lengthOf(type)
    return anchorShip(
      { type, length, orientation, facing },
      cell,
      sternIndex(facing, length),
      rules.gridSize,
    )
  }

  const onCellClick = (coord: Coord) => {
    if (clickSuppressed()) return
    const ship = shipAt(state.boards.human, coord)
    if (ship) return rotatePlaced(ship, coord)
    if (!selectedType) return
    const candidate = nextShipAt(selectedType, coord)
    if (!commit(candidate)) shake()
  }

  const hoverCandidate: PlacedShip | null =
    selectedType && hover ? nextShipAt(selectedType, hover) : null
  const preview = drag
    ? { ship: drag.target, valid: drag.valid }
    : {
        ship: hoverCandidate,
        valid: !!hoverCandidate && validatePlacement(ships, hoverCandidate, rules) === null,
      }
  const previewCells = preview.ship ? shipCells(preview.ship) : []
  const liftedType = drag?.session.from === 'board' ? drag.session.type : null
  const ghostLength = drag ? drag.session.length * drag.pitch - (drag.pitch - drag.cellSize) : 0

  const getCell = (coord: Coord): CellView => {
    const inPreview = previewCells.some((c) => sameCoord(c, coord))
    const ship = shipAt(state.boards.human, coord)
    return {
      ship: ship?.type,
      preview: inPreview ? (preview.valid ? 'valid' : 'invalid') : undefined,
      clickable: true,
      draggable: !!ship,
    }
  }

  const boardShips: BoardShip[] = ships.map((ship) => ({
    ship,
    lifted: ship.type === liftedType,
    team: myTeam,
  }))
  if (preview.ship)
    boardShips.push({ ship: preview.ship, preview: preview.valid ? 'valid' : 'invalid' })

  const complete = isFleetComplete(ships, rules)
  const hint = (
    <p className="text-center text-xs text-slate-400">
      Tap a square to place the highlighted ship. Drag ships to move them, tap a ship to rotate it.{' '}
      <span className="hidden lg:inline">
        Scroll the mouse wheel or press <kbd className="rounded bg-slate-700 px-1">R</kbd> to turn
        ships clockwise; scroll up, right-click or press Shift+R to turn them back.
      </span>
    </p>
  )

  return (
    <div
      className={
        landscape
          ? 'grid grid-cols-[auto_minmax(0,22rem)] items-start justify-center gap-3'
          : 'mx-auto flex w-full max-w-[26rem] flex-col gap-4 lg:grid lg:max-w-none lg:grid-cols-[26rem_22rem] lg:justify-center lg:gap-x-8 lg:gap-y-5'
      }
    >
      <h2 className="sr-only text-center text-lg font-semibold text-sky-100 lg:not-sr-only lg:col-start-1 lg:row-start-1">
        Deploy your fleet
      </h2>

      <section
        aria-label="Fleet controls"
        className={`flex flex-col gap-3 rounded-xl border border-sky-800/60 bg-slate-900/70 p-3 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:p-5 ${landscape ? 'col-start-2 row-start-1' : ''}`}
      >
        <h3 className="hidden text-sm font-semibold uppercase tracking-wide text-sky-300 lg:block">
          Ships
        </h3>
        <ul
          className="flex flex-wrap justify-center gap-1.5 lg:flex-col lg:gap-2"
          aria-label="Ships"
        >
          {rules.fleet.map((spec) => {
            const placed = ships.some((s) => s.type === spec.type)
            const isSelected = selectedType === spec.type
            return (
              <li key={spec.type} className="lg:w-full">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onPointerDown={(e) =>
                    !placed &&
                    startDrag(
                      e,
                      { type: spec.type, length: spec.length, orientation, facing },
                      Math.floor(spec.length / 2),
                      'tray',
                    )
                  }
                  onClick={() => {
                    if (clickSuppressed()) return
                    if (placed) removeShip(spec.type)
                    setSelected(spec.type)
                  }}
                  className={`flex w-full touch-none items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition [-webkit-touch-callout:none] lg:px-3 lg:py-2 lg:text-sm ${
                    isSelected
                      ? 'border-amber-300 bg-slate-800'
                      : 'border-slate-700 hover:border-slate-500'
                  } ${placed ? 'text-slate-500' : 'cursor-grab text-slate-100'}`}
                >
                  <span>
                    {spec.name}
                    {placed && <span className="sr-only lg:not-sr-only"> (placed)</span>}
                  </span>
                  <ShipSprite
                    type={spec.type}
                    length={spec.length}
                    team={myTeam}
                    className={`h-3 shrink-0 lg:h-4 ${placed ? 'opacity-35 grayscale' : ''}`}
                    style={{ aspectRatio: spec.length }}
                  />
                </button>
              </li>
            )
          })}
        </ul>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => turnNext(1)}
            className="btn-secondary whitespace-nowrap px-2 capitalize"
            aria-label={`Rotate (facing ${facing})`}
          >
            <span aria-hidden="true">↻ </span>
            {facing}
          </button>
          <button
            type="button"
            onClick={randomizeFleet}
            className="btn-secondary whitespace-nowrap px-2"
          >
            Randomize
          </button>
          <button
            type="button"
            onClick={clearFleet}
            className="btn-secondary whitespace-nowrap px-2"
          >
            Clear
          </button>
        </div>
        {landscape && hint}
      </section>

      <section
        className={
          landscape
            ? 'sticky top-0 col-start-1 row-span-4 row-start-1 w-[min(26rem,calc(100dvh-5.5rem),calc(100vw-23.5rem))] self-start'
            : 'flex flex-col items-center gap-3 lg:col-start-1 lg:row-start-2 lg:row-span-4'
        }
      >
        <div ref={boardScope} className="w-full">
          <Grid
            size={rules.gridSize}
            label="Your fleet placement"
            gridRef={gridRef}
            touchDrag
            getCell={getCell}
            ships={boardShips}
            onCellHover={setHover}
            onCellClick={onCellClick}
            onCellContextMenu={(coord) => {
              const ship = shipAt(state.boards.human, coord)
              if (ship) rotatePlaced(ship, coord, -1)
              else turnNext(-1)
            }}
            onCellPointerDown={(coord, e) => {
              const ship = shipAt(state.boards.human, coord)
              if (!ship) return
              const grabIndex = shipCells(ship).findIndex((c) => sameCoord(c, coord))
              startDrag(e, ship, grabIndex, 'board')
            }}
          />
        </div>
        {!landscape && hint}
      </section>

      <section
        className={`rounded-xl border border-sky-800/60 bg-slate-900/70 p-3 lg:col-start-2 lg:row-start-3 lg:p-5 ${landscape ? 'col-start-2 row-start-3' : ''}`}
      >
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-300">
          Opponent
        </h3>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="AI difficulty">
          {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={state.difficulty === d}
              onClick={() => setDifficulty(d)}
              className={`rounded-lg border px-2 py-1.5 text-sm capitalize transition ${
                state.difficulty === d
                  ? 'border-amber-300 bg-amber-300 font-semibold text-slate-900'
                  : 'border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">{DIFFICULTY_INFO[state.difficulty]}</p>
      </section>

      <section
        className={`rounded-xl border border-sky-800/60 bg-slate-900/70 p-3 lg:col-start-2 lg:row-start-4 lg:p-5 ${landscape ? 'col-start-2 row-start-4' : ''}`}
      >
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-300">Colors</h3>
        <div className="flex flex-col gap-2">
          <ColorPicker
            label="Your fleet"
            value={colors.human}
            onChange={(c) => setColor('human', c)}
          />
          <ColorPicker label="Enemy fleet" value={colors.ai} onChange={(c) => setColor('ai', c)} />
        </div>
      </section>

      <div
        className={
          landscape
            ? 'col-start-2 row-start-2'
            : 'sticky bottom-0 -mx-3 bg-slate-950/90 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:col-start-2 lg:row-start-5 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none'
        }
      >
        <button
          type="button"
          disabled={!complete}
          onClick={startGame}
          className="btn-primary w-full"
        >
          {complete ? 'Start battle' : `Place ${rules.fleet.length - ships.length} more`}
        </button>
      </div>

      {drag && !drag.target && (
        <div
          aria-hidden="true"
          data-testid="drag-ghost"
          className="pointer-events-none fixed z-50 opacity-90 drop-shadow-lg"
          style={{
            left:
              drag.x -
              (drag.session.orientation === 'horizontal'
                ? (drag.session.grabIndex + 0.5) * drag.pitch
                : drag.cellSize / 2),
            top:
              drag.y -
              (drag.session.orientation === 'vertical'
                ? (drag.session.grabIndex + 0.5) * drag.pitch
                : drag.cellSize / 2),
          }}
        >
          <ShipSprite
            type={drag.session.type}
            length={drag.session.length}
            orientation={drag.session.orientation}
            team={myTeam}
            facing={drag.session.facing}
            style={
              drag.session.orientation === 'horizontal'
                ? { width: ghostLength, height: drag.cellSize }
                : { width: drag.cellSize, height: ghostLength }
            }
          />
        </div>
      )}
    </div>
  )
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: TeamColor
  onChange: (color: TeamColor) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-300">
        {label}: <span className="font-semibold capitalize text-slate-100">{value}</span>
      </p>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label={`${label} color`}>
        {TEAM_COLOR_NAMES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={c[0].toUpperCase() + c.slice(1)}
            title={c[0].toUpperCase() + c.slice(1)}
            onClick={() => onChange(c)}
            className={`aspect-square min-h-7 rounded-md border-2 transition ${
              value === c
                ? 'border-amber-300 ring-2 ring-amber-300/60'
                : 'border-slate-600 hover:border-slate-400'
            }`}
            style={{ backgroundColor: TEAM_COLORS[c] }}
          />
        ))}
      </div>
    </div>
  )
}
