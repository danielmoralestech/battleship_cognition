import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { GameApi } from '../hooks/useGame'

export function GameOverModal({ game }: { game: GameApi }) {
  const { state, stats, playAgain } = game
  const [dismissed, setDismissed] = useState(false)
  const open = state.phase === 'gameOver' && !dismissed
  const won = state.winner === 'human'
  const shots = state.log.filter((e) => e.by === 'human')
  const hits = shots.filter((e) => e.result !== 'miss').length
  const record = stats[state.difficulty]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-20 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.6 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-over-title"
            className="w-full max-w-sm rounded-2xl border border-sky-700 bg-slate-900 p-6 text-center shadow-2xl"
            initial={{ y: 40, scale: 0.9 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <h2
              id="game-over-title"
              className={`text-3xl font-black ${won ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {won ? 'Victory!' : 'Defeat'}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {won
                ? `You sank the enemy fleet in ${shots.length} shots.`
                : 'The enemy sank your entire fleet.'}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-slate-400">Accuracy</dt>
                <dd className="font-semibold">
                  {shots.length ? Math.round((hits / shots.length) * 100) : 0}%
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 capitalize">{state.difficulty} W</dt>
                <dd className="font-semibold">{record.wins}</dd>
              </div>
              <div>
                <dt className="text-slate-400 capitalize">{state.difficulty} L</dt>
                <dd className="font-semibold">{record.losses}</dd>
              </div>
            </dl>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDismissed(true)}>
                Review
              </button>
              <button type="button" className="btn-primary" onClick={() => playAgain(true)}>
                Rematch
              </button>
              <button type="button" className="btn-secondary" onClick={() => playAgain(false)}>
                New fleet
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
