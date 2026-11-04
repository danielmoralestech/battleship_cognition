import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { playGameOver } from '../audio/sound'
import { Celebration } from '../effects'
import type { GameApi } from '../hooks/useGame'

/** `hold` keeps the result hidden, e.g. while the 3D view's final shell is still in flight. */
export function GameOverModal({ game, hold = false }: { game: GameApi; hold?: boolean }) {
  const { state, stats, playAgain } = game
  const [dismissed, setDismissed] = useState(false)
  const [wasHeld, setWasHeld] = useState(hold)
  if (hold && !wasHeld) setWasHeld(true)
  const open = state.phase === 'gameOver' && !dismissed && !hold
  // After a held 3D finish, leave time for the sinking blast before the dialog covers it.
  const delay = wasHeld ? 1 : 0.6
  const won = state.winner === 'human'
  // The fanfare or horn waits for the final sinking blast and comes in with the dialog.
  const sounded = useRef(false)
  useEffect(() => {
    if (!open || sounded.current) return
    sounded.current = true
    playGameOver(won, (delay + 0.6) * 1000)
  }, [open, won, delay])
  const shots = state.log.filter((e) => e.by === 'human')
  const hits = shots.filter((e) => e.result !== 'miss').length
  const record = stats[state.difficulty]

  return (
    <>
      {open && <Celebration won={won} />}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-20 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="game-over-title"
              className="w-full max-w-sm rounded-2xl border border-sky-700 bg-slate-900 p-6 text-center shadow-2xl"
              initial={{ y: 40, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ delay, type: 'spring', stiffness: 260, damping: 20 }}
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
    </>
  )
}
