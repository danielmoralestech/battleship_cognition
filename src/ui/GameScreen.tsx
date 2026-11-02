import { useEffect, useState, type ReactNode } from 'react'
import { canFire } from '../engine/game'
import { coordKey, isShipSunk, sameCoord, shipAt } from '../engine/board'
import { getTargetView } from '../engine/view'
import type { Coord, PlayerId, ShotEvent } from '../engine/types'
import { Announcer, ImpactShake, describeShot } from '../effects'
import type { GameApi } from '../hooks/useGame'
import { useBattleLayout } from '../hooks/useMediaQuery'
import { FleetStatus } from './FleetStatus'
import { Grid, type CellView } from './Grid'

export function GameScreen({ game }: { game: GameApi }) {
  const { state, fire } = game
  const layout = useBattleLayout()
  const [fleetOpen, setFleetOpen] = useState(false)
  const { rules, boards, log } = state
  const latest = log[log.length - 1] ?? null
  const latestBy = (p: PlayerId): ShotEvent | null =>
    [...log].reverse().find((e) => e.by === p) ?? null

  const enemyView = getTargetView(boards.ai, rules)
  const revealEnemy = state.phase === 'gameOver'

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
        className={`font-semibold uppercase ${layout === 'landscape' ? 'text-xs tracking-wide' : 'text-sm tracking-widest'} ${humanTurn ? 'text-amber-300' : 'text-slate-400'}`}
        data-testid="turn-indicator"
      >
        {state.phase === 'gameOver'
          ? 'Battle over'
          : humanTurn
            ? 'Your turn: fire at enemy waters'
            : 'Enemy is aiming...'}
      </p>
      <Announcer event={latest} rules={rules} compact={layout === 'landscape'} />
    </div>
  )

  const enemyBoard = (
    <ImpactShake event={latestBy('human')}>
      <Grid
        size={rules.gridSize}
        label="Enemy waters"
        getCell={enemyCell}
        onCellClick={(coord) => humanTurn && fire(coord)}
        dimmed={!humanTurn && state.phase === 'playing'}
      />
    </ImpactShake>
  )
  const myBoard = (mini = false) => (
    <ImpactShake event={latestBy('ai')}>
      <Grid size={rules.gridSize} label="Your fleet" getCell={myCell} mini={mini} />
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
      <div className="flex flex-col items-center gap-3">
        {status}
        <section
          aria-label="Enemy waters"
          className="w-full max-w-[clamp(16rem,calc(100dvh-22.5rem),26rem)]"
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
            {enemyFleet}
            {myFleet}
            <p className="text-xs text-slate-400">
              {myStats}
              <br />
              {theirStats}
            </p>
          </div>
        </section>
        <BattleLog game={game} collapsible />
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
          {enemyFleet}
          {myFleet}
          <p className="text-[11px] text-slate-400">
            You: {mine.shots} shots, {mine.accuracy}%
            <br />
            Enemy: {theirs.shots} shots, {theirs.accuracy}%
          </p>
          <BattleLog game={game} collapsible />
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

function BattleLog({ game, collapsible }: { game: GameApi; collapsible?: boolean }) {
  const { log, rules } = game.state
  const entries = (n: number) =>
    log
      .slice(-n)
      .reverse()
      .map((e) => (
        <li key={e.id}>
          <span className={e.by === 'human' ? 'text-sky-300' : 'text-rose-300'}>
            {e.by === 'human' ? 'You' : 'Enemy'}
          </span>{' '}
          {describeShot(e, rules).text}
        </li>
      ))
  const list = (n: number) => (
    <ol
      className="w-full max-w-2xl space-y-0.5 text-center text-xs text-slate-400"
      aria-label="Battle log"
    >
      {entries(n)}
    </ol>
  )
  if (!collapsible) return list(6)
  if (log.length === 0) return null
  return (
    <details className="w-full max-w-[26rem] rounded-lg border border-slate-800 px-3 py-2 text-xs">
      <summary className="cursor-pointer text-slate-300">Battle log ({log.length} shots)</summary>
      <div className="mt-2">{list(20)}</div>
    </details>
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
