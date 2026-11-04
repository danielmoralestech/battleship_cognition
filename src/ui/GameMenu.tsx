import { useState } from 'react'
import type { GameApi } from '../hooks/useGame'

type Action = 'restart' | 'newFleet'

const LABELS: Record<Action, string> = { restart: 'Restart', newFleet: 'New fleet' }

/**
 * Restart / New fleet: inline on wider screens, behind a menu on phones, confirmed mid-battle.
 * `viewSwitch` adds a 2D/3D view switch as the first item.
 */
export function GameMenu({
  game,
  viewSwitch,
}: {
  game: GameApi
  viewSwitch?: { label: string; onClick: () => void }
}) {
  const { state, playAgain } = game
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, setPending] = useState<Action | null>(null)
  const over = state.phase === 'gameOver'
  const label = (a: Action) => (a === 'restart' && over ? 'Rematch' : LABELS[a])

  const run = (a: Action) => playAgain(a === 'restart')
  const request = (a: Action) => {
    setMenuOpen(false)
    if (state.phase === 'playing' && state.log.length > 0) setPending(a)
    else run(a)
  }

  return (
    <>
      <div className="hidden items-center gap-3 sm:flex">
        {viewSwitch && (
          <button type="button" className="btn-secondary" onClick={viewSwitch.onClick}>
            {viewSwitch.label}
          </button>
        )}
        {(['restart', 'newFleet'] as const).map((a) => (
          <button key={a} type="button" className="btn-secondary" onClick={() => request(a)}>
            {label(a)}
          </button>
        ))}
      </div>

      <div className="relative sm:hidden">
        <button
          type="button"
          className="btn-secondary px-2.5 text-base leading-none"
          aria-label="Game menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 flex w-40 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
            >
              {viewSwitch && (
                <button
                  type="button"
                  role="menuitem"
                  className="border-b border-slate-800 px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false)
                    viewSwitch.onClick()
                  }}
                >
                  {viewSwitch.label}
                </button>
              )}
              {(['restart', 'newFleet'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  role="menuitem"
                  className="px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => request(a)}
                >
                  {label(a)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {pending && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center shadow-2xl"
          >
            <h2 id="confirm-title" className="text-lg font-bold text-slate-100">
              Abandon this battle?
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {pending === 'restart'
                ? 'You keep your fleet placement and start over.'
                : 'You go back to placing a new fleet.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-secondary py-2.5"
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setPending(null)
                  run(pending)
                }}
              >
                {LABELS[pending]}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
