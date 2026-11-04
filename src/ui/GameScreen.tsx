import { useEffect, useRef, useState, type ReactNode } from 'react'
import { canFire } from '../engine/game'
import { coordKey, isShipSunk, sameCoord, shipAt, shipCells } from '../engine/board'
import { getTargetView } from '../engine/view'
import type { Coord, PlayerId, ShotEvent } from '../engine/types'
import { useShotSound } from '../audio/useShotSound'
import { SHELL_MS } from '../effects/timing'
import { Announcer, BoardFx, ImpactShake, ScreenFlash, ShotLog } from '../effects'
import type { GameApi } from '../hooks/useGame'
import { useBattleLayout, useMediaQuery } from '../hooks/useMediaQuery'
import { FleetStatus } from './FleetStatus'
import { useAim } from './aim'
import { FireButton } from './FireButton'
import { Grid, type CellView } from './Grid'
import type { BoardShip } from './ShipSprite'
import { useTeamHex } from './teamColors'

export function GameScreen({ game }: { game: GameApi }) {
  const { state, fire } = game
  const layout = useBattleLayout()
  const teamHex = useTeamHex()
  const [fleetOpen, setFleetOpen] = useState(false)
  const aim = useAim(state, fire)
  const { rules, boards, log } = state
  const latest = log[log.length - 1] ?? null
  const latestBy = (p: PlayerId): ShotEvent | null =>
    [...log].reverse().find((e) => e.by === p) ?? null

  const enemyView = getTargetView(boards.ai, rules)
  const revealEnemy = state.phase === 'gameOver'
  const announcedSunk = new Set(enemyView.sunkShips.map((s) => s.type))
  // Shots restored from storage, and reduced motion, play no shell, so their wrecks show at once.
  const [restoredShot] = useState(() => latest?.id ?? 0)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  useShotSound(latest, rules, reducedMotion ? 0 : SHELL_MS)
  const justSunk = (by: PlayerId) => {
    const e = latestBy(by)
    if (reducedMotion || !e || e.id <= restoredShot) return undefined
    return e.result === 'sunk' ? e.sunkShip : undefined
  }
  const enemyJustSunk = justSunk('human')
  const myJustSunk = justSunk('ai')
  const enemyShips: BoardShip[] = boards.ai.ships
    .filter((ship) => revealEnemy || announcedSunk.has(ship.type))
    .map((ship) => ({
      ship,
      sunk: isShipSunk(boards.ai, ship),
      sinking: ship.type === enemyJustSunk ? 'reveal' : undefined,
      team: teamHex('ai'),
    }))
  const myShips: BoardShip[] = boards.human.ships.map((ship) => ({
    ship,
    sunk: isShipSunk(boards.human, ship),
    sinking: ship.type === myJustSunk ? 'wreck' : undefined,
    team: teamHex('human'),
  }))

  const enemyGridRef = useRef<HTMLDivElement>(null)
  const myGridRef = useRef<HTMLDivElement>(null)

  const sunkCells = (e: ShotEvent | null): Coord[] => {
    if (e?.result !== 'sunk') return []
    if (e.by === 'human') return enemyView.sunkShips.find((s) => s.type === e.sunkShip)?.cells ?? []
    const ship = boards.human.ships.find((s) => s.type === e.sunkShip)
    return ship ? shipCells(ship) : []
  }

  const isLatest = (by: PlayerId, coord: Coord) =>
    !!latest && latest.by === by && sameCoord(latest.coord, coord)

  const enemyCell = (coord: Coord): CellView => {
    const cell = enemyView.cells[coord.row][coord.col]
    const sunkShip = enemyView.sunkShips.find((s) => s.cells.some((c) => sameCoord(c, coord)))
    const hiddenShip = revealEnemy ? shipAt(boards.ai, coord) : undefined
    return {
      ship: sunkShip?.type ?? hiddenShip?.type,
      shot: cell === 'unknown' ? undefined : cell,
      animate: isLatest('human', coord),
      clickable: canFire(state, 'human', coord),
      aimed: !!aim.aimed && sameCoord(aim.aimed, coord),
    }
  }

  const myCell = (coord: Coord): CellView => {
    const ship = shipAt(boards.human, coord)
    const shot = boards.human.shots[coordKey(coord)]
    return {
      ship: ship?.type,
      shot: !shot
        ? undefined
        : shot === 'miss'
          ? 'miss'
          : ship && isShipSunk(boards.human, ship)
            ? 'sunk'
            : 'hit',
      animate: isLatest('ai', coord),
    }
  }

  const humanTurn = state.phase === 'playing' && state.turn === 'human'
  const shotStats = (p: PlayerId) => {
    const shots = log.filter((e) => e.by === p)
    const hits = shots.filter((e) => e.result !== 'miss').length
    return {
      shots: shots.length,
      accuracy: shots.length ? Math.round((hits / shots.length) * 100) : 0,
    }
  }
  const mine = shotStats('human')
  const theirs = shotStats('ai')

  const status = (
    <div className="flex flex-col items-center gap-1">
      <p
        className={`font-semibold uppercase ${layout === 'landscape' ? 'text-xs tracking-wide' : 'text-xs tracking-wide min-[360px]:text-sm min-[360px]:tracking-widest'} ${humanTurn ? 'text-amber-300' : 'text-slate-400'}`}
        data-testid="turn-indicator"
      >
        {state.phase === 'gameOver'
          ? 'Battle over'
          : humanTurn
            ? `Your turn: ${aim.enabled ? 'aim' : 'fire'} at enemy waters`
            : 'Enemy is aiming...'}
      </p>
      <Announcer event={latest} log={log} rules={rules} compact={layout === 'landscape'} />
      <ScreenFlash event={latest} />
    </div>
  )

  const fireButton = (className: string) =>
    aim.enabled && state.phase === 'playing' && <FireButton aim={aim} className={className} />

  const enemyAiming = state.phase === 'playing' && !humanTurn
  const enemyBoard = (
    <ImpactShake event={latestBy('human')}>
      <BoardFx
        event={latestBy('human')}
        side="enemy"
        gridRef={enemyGridRef}
        sunkCells={sunkCells(latestBy('human'))}
        sweep={humanTurn ? 'scan' : null}
      >
        <Grid
          size={rules.gridSize}
          label="Enemy waters"
          getCell={enemyCell}
          ships={enemyShips}
          onCellClick={aim.select}
          dimmed={enemyAiming}
          gridRef={enemyGridRef}
        />
      </BoardFx>
    </ImpactShake>
  )
  const myBoard = (mini = false) => (
    <ImpactShake event={latestBy('ai')}>
      {mini ? (
        <Grid size={rules.gridSize} label="Your fleet" getCell={myCell} ships={myShips} mini />
      ) : (
        <BoardFx
          event={latestBy('ai')}
          side="mine"
          gridRef={myGridRef}
          sunkCells={sunkCells(latestBy('ai'))}
          sweep={enemyAiming ? 'threat' : null}
        >
          <Grid
            size={rules.gridSize}
            label="Your fleet"
            getCell={myCell}
            ships={myShips}
            gridRef={myGridRef}
          />
        </BoardFx>
      )}
    </ImpactShake>
  )
  const compact = layout !== 'wide'
  const enemyFleet = (
    <FleetStatus
      title="Enemy fleet"
      rules={rules}
      compact={compact}
      sunk={enemyView.sunkShips.map((s) => s.type)}
    />
  )
  const myFleet = (
    <FleetStatus
      title="Your fleet"
      rules={rules}
      compact={compact}
      sunk={boards.human.ships.filter((s) => isShipSunk(boards.human, s)).map((s) => s.type)}
    />
  )
  const myStats = `Your shots: ${mine.shots} · Accuracy: ${mine.accuracy}%`
  const theirStats = `Enemy shots: ${theirs.shots} · Accuracy: ${theirs.accuracy}%`

  if (layout === 'portrait') {
    return (
      <div className="flex flex-col items-center gap-3 max-[359px]:gap-2">
        {status}
        <section
          aria-label="Enemy waters"
          className="w-full max-w-[clamp(15rem,calc(100dvh-23.25rem),26rem)]"
        >
          {enemyBoard}
        </section>
        <section aria-label="Battle status" className="flex w-full max-w-[26rem] items-start gap-3">
          <button
            type="button"
            className="w-32 shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 p-1.5 text-left"
            aria-label="Show your fleet"
            onClick={() => setFleetOpen(true)}
          >
            {myBoard(true)}
            <span className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-sky-300">
              Your fleet <span aria-hidden="true">⤢</span>
            </span>
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {fireButton('w-full whitespace-nowrap px-2 py-1.5 text-xs min-[360px]:text-sm')}
            {enemyFleet}
            {myFleet}
            <p className="text-[11px] text-slate-400 min-[360px]:text-xs">
              {myStats}
              <br />
              {theirStats}
            </p>
          </div>
        </section>
        {fleetOpen && <FleetSheet onClose={() => setFleetOpen(false)}>{myBoard()}</FleetSheet>}
      </div>
    )
  }

  if (layout === 'landscape') {
    // Height-bound, but also capped so 2 boards + 9rem column + 2 gaps + main padding fit the width.
    const boardWidth = 'w-[min(26rem,calc(100dvh-5.5rem),calc(50vw-6rem))] shrink-0'
    return (
      <div className="flex items-start justify-center gap-3">
        <section aria-label="Enemy waters" className={boardWidth}>
          {enemyBoard}
        </section>
        <div className="flex w-36 shrink-0 flex-col gap-2 text-center">
          {status}
          {fireButton('w-full whitespace-nowrap px-1 py-1.5 text-xs')}
          {enemyFleet}
          {myFleet}
          <p className="text-[11px] text-slate-400">
            You: {mine.shots} shots, {mine.accuracy}%
            <br />
            Enemy: {theirs.shots} shots, {theirs.accuracy}%
          </p>
        </div>
        <section aria-label="Your fleet" className={boardWidth}>
          {myBoard()}
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {status}
      <div className="flex w-full flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <section className="flex w-full max-w-[26rem] flex-col items-center gap-3">
          <h2 className="text-lg font-semibold text-sky-100">Enemy waters</h2>
          {enemyBoard}
          {fireButton('w-full py-2')}
          {enemyFleet}
          <p className="text-xs text-slate-400">{myStats}</p>
        </section>
        <section className="flex w-full max-w-[26rem] flex-col items-center gap-3">
          <h2 className="text-lg font-semibold text-sky-100">Your fleet</h2>
          {myBoard()}
          {myFleet}
          <p className="text-xs text-slate-400">{theirStats}</p>
        </section>
      </div>
      <BattleLog game={game} />
    </div>
  )
}

function BattleLog({ game }: { game: GameApi }) {
  const { log, rules } = game.state
  return (
    <ShotLog
      log={log}
      rules={rules}
      limit={6}
      className="w-full max-w-2xl text-center text-slate-400"
    />
  )
}

function FleetSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/70"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fleet-sheet-title"
        className="w-full max-w-[28rem] rounded-t-2xl border border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="fleet-sheet-title" className="text-lg font-semibold text-sky-100">
            Your fleet
          </h2>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
