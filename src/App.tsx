import { MotionConfig } from 'motion/react'
import { useGame } from './hooks/useGame'
import { GameOverModal } from './ui/GameOverModal'
import { GameScreen } from './ui/GameScreen'
import { SetupScreen } from './ui/SetupScreen'

export default function App() {
  const game = useGame()
  const { state, stats, playAgain } = game
  const record = stats[state.difficulty]

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-sky-950 text-slate-100">
        <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <h1 className="text-2xl font-black tracking-tight text-sky-100">
            <span aria-hidden="true">⚓ </span>Battleship
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full border border-slate-700 px-3 py-1 capitalize text-slate-300">
              {state.difficulty} AI &middot; {record.wins}W / {record.losses}L
            </span>
            {state.phase !== 'setup' && (
              <>
                <button type="button" className="btn-secondary" onClick={() => playAgain(true)}>
                  {state.phase === 'gameOver' ? 'Rematch' : 'Restart'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => playAgain(false)}>
                  New fleet
                </button>
              </>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-12">
          {state.phase === 'setup' ? <SetupScreen game={game} /> : <GameScreen game={game} />}
        </main>
        <GameOverModal key={state.phase === 'gameOver' ? 'over' : 'active'} game={game} />
      </div>
    </MotionConfig>
  )
}
