import { useCallback, useEffect, useState } from 'react'
import { isFleetComplete, sameCoord, shipAt, shipCells, validatePlacement } from '../engine/board'
import type { Coord, Difficulty, Orientation, PlacedShip, ShipType } from '../engine/types'
import type { GameApi } from '../hooks/useGame'
import { Grid, type CellView } from './Grid'
import { SHIP_COLORS } from './ships'

const DIFFICULTY_INFO: Record<Difficulty, string> = {
  easy: 'Fires at random.',
  medium: 'Hunts in a checkerboard, then chases hits.',
  hard: 'Calculates where your ships most likely are.',
}

export function SetupScreen({ game }: { game: GameApi }) {
  const { state, placeShip, removeShip, randomizeFleet, clearFleet, setDifficulty, startGame } =
    game
  const { rules } = state
  const ships = state.boards.human.ships
  const firstUnplaced = rules.fleet.find((s) => !ships.some((p) => p.type === s.type))?.type ?? null

  const [selected, setSelected] = useState<ShipType | null>(firstUnplaced)
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [hover, setHover] = useState<Coord | null>(null)

  const activeShip = selected && !ships.some((s) => s.type === selected) ? selected : null
  const selectedType = activeShip ?? firstUnplaced
  const rotate = useCallback(
    () => setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal')),
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rotate])

  const candidate: PlacedShip | null =
    selectedType && hover
      ? {
          type: selectedType,
          length: rules.fleet.find((s) => s.type === selectedType)!.length,
          orientation,
          origin: hover,
        }
      : null
  const candidateValid = candidate ? validatePlacement(ships, candidate, rules) === null : false
  const candidateCells = candidate ? shipCells(candidate) : []

  const tryPlace = (origin: Coord) => {
    if (!selectedType) return false
    const length = rules.fleet.find((s) => s.type === selectedType)!.length
    const ship: PlacedShip = { type: selectedType, length, orientation, origin }
    if (validatePlacement(ships, ship, rules) !== null) return false
    placeShip(ship)
    const next = rules.fleet.find(
      (s) => s.type !== selectedType && !ships.some((p) => p.type === s.type),
    )
    setSelected(next?.type ?? null)
    return true
  }

  const pickUp = (coord: Coord) => {
    const ship = shipAt(state.boards.human, coord)
    if (!ship) return
    removeShip(ship.type)
    setSelected(ship.type)
    setOrientation(ship.orientation)
  }

  const getCell = (coord: Coord): CellView => {
    const inPreview = candidateCells.some((c) => sameCoord(c, coord))
    const ship = shipAt(state.boards.human, coord)
    return {
      ship: ship?.type,
      preview: inPreview ? (candidateValid ? 'valid' : 'invalid') : undefined,
      clickable: true,
      draggable: !!ship,
    }
  }

  const complete = isFleetComplete(ships, rules)

  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
      <section className="flex w-full max-w-[26rem] flex-col items-center gap-3">
        <h2 className="text-lg font-semibold text-sky-100">Deploy your fleet</h2>
        <Grid
          size={rules.gridSize}
          label="Your fleet placement"
          getCell={getCell}
          onCellHover={setHover}
          onCellClick={(coord) => {
            if (!tryPlace(coord)) pickUp(coord)
          }}
          onCellContextMenu={rotate}
          onCellDragStart={(coord, e) => {
            e.dataTransfer.effectAllowed = 'move'
            pickUp(coord)
          }}
          onCellDrop={(coord) => tryPlace(coord)}
        />
        <p className="text-center text-xs text-slate-400">
          Click or drag to place. Press <kbd className="rounded bg-slate-700 px-1">R</kbd> or
          right-click to rotate. Click a placed ship to move it.
        </p>
      </section>

      <aside className="flex w-full max-w-xs flex-col gap-5 rounded-xl border border-sky-800/60 bg-slate-900/70 p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-300">Ships</h3>
          <ul className="flex flex-col gap-2">
            {rules.fleet.map((spec) => {
              const placed = ships.some((s) => s.type === spec.type)
              const isSelected = selectedType === spec.type
              return (
                <li key={spec.type}>
                  <button
                    type="button"
                    draggable={!placed}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      setSelected(spec.type)
                    }}
                    onClick={() => (placed ? removeShip(spec.type) : null, setSelected(spec.type))}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'border-amber-300 bg-slate-800'
                        : 'border-slate-700 hover:border-slate-500'
                    } ${placed ? 'text-slate-500' : 'text-slate-100'}`}
                  >
                    <span>
                      {spec.name} {placed && <span className="text-xs">(placed)</span>}
                    </span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: spec.length }, (_, i) => (
                        <span
                          key={i}
                          className={`size-3 rounded-[2px] ${placed ? 'bg-slate-600' : SHIP_COLORS[spec.type]}`}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={rotate} className="btn-secondary">
            {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
          </button>
          <button type="button" onClick={randomizeFleet} className="btn-secondary">
            Randomize
          </button>
          <button type="button" onClick={clearFleet} className="btn-secondary">
            Clear
          </button>
        </div>

        <div>
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
        </div>

        <button type="button" disabled={!complete} onClick={startGame} className="btn-primary">
          {complete ? 'Start battle' : `Place ${rules.fleet.length - ships.length} more`}
        </button>
      </aside>
    </div>
  )
}
