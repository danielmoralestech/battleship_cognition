import { canFire } from '../engine/game'
import { coordKey, isShipSunk, sameCoord, shipAt } from '../engine/board'
import { getTargetView } from '../engine/view'
import type { Coord, PlayerId, ShotEvent } from '../engine/types'
import { Announcer, ImpactShake, describeShot } from '../effects'
import type { GameApi } from '../hooks/useGame'
import { FleetStatus } from './FleetStatus'
import { Grid, type CellView } from './Grid'

export function GameScreen({ game }: { game: GameApi }) {
  const { state, fire } = game
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

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <p
          className={`text-sm font-semibold uppercase tracking-widest ${humanTurn ? 'text-amber-300' : 'text-slate-400'}`}
          data-testid="turn-indicator"
        >
          {state.phase === 'gameOver'
            ? 'Battle over'
            : humanTurn
              ? 'Your turn: fire at enemy waters'
              : 'Enemy is aiming...'}
        </p>
        <Announcer event={latest} rules={rules} />
      </div>

      <div className="flex w-full flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <section className="flex w-full max-w-[26rem] flex-col items-center gap-3">
          <h2 className="text-lg font-semibold text-sky-100">Enemy waters</h2>
          <ImpactShake event={latestBy('human')}>
            <Grid
              size={rules.gridSize}
              label="Enemy waters"
              getCell={enemyCell}
              onCellClick={(coord) => humanTurn && fire(coord)}
              dimmed={!humanTurn && state.phase === 'playing'}
            />
          </ImpactShake>
          <FleetStatus
            title="Enemy fleet"
            rules={rules}
            sunk={enemyView.sunkShips.map((s) => s.type)}
          />
          <p className="text-xs text-slate-400">
            Your shots: {mine.shots} &middot; Accuracy: {mine.accuracy}%
          </p>
        </section>

        <section className="flex w-full max-w-[26rem] flex-col items-center gap-3">
          <h2 className="text-lg font-semibold text-sky-100">Your fleet</h2>
          <ImpactShake event={latestBy('ai')}>
            <Grid size={rules.gridSize} label="Your fleet" getCell={myCell} />
          </ImpactShake>
          <FleetStatus
            title="Your fleet"
            rules={rules}
            sunk={boards.human.ships.filter((s) => isShipSunk(boards.human, s)).map((s) => s.type)}
          />
          <p className="text-xs text-slate-400">
            Enemy shots: {theirs.shots} &middot; Accuracy: {theirs.accuracy}%
          </p>
        </section>
      </div>

      <ol
        className="w-full max-w-2xl space-y-0.5 text-center text-xs text-slate-400"
        aria-label="Battle log"
      >
        {log
          .slice(-6)
          .reverse()
          .map((e) => (
            <li key={e.id}>
              <span className={e.by === 'human' ? 'text-sky-300' : 'text-rose-300'}>
                {e.by === 'human' ? 'You' : 'Enemy'}
              </span>{' '}
              {describeShot(e, rules).text}
            </li>
          ))}
      </ol>
    </div>
  )
}
