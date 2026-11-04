import { useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { useGame } from './hooks/useGame'
import { installSoundUnlock, setSoundEnabled } from './audio/sound'
import { loadColors, loadSettings, saveColors, saveSettings } from './storage/persist'
import { useBattleLayout } from './hooks/useMediaQuery'
import { Battle3DLoader } from './ui/Battle3DLoader'
import { GameMenu } from './ui/GameMenu'
import { GameOverModal } from './ui/GameOverModal'
import { GameScreen } from './ui/GameScreen'
import { SetupScreen } from './ui/SetupScreen'
import { SettingsContext, type SettingsApi } from './ui/settings'
import { FleetColorsContext, type FleetColorsApi } from './ui/teamColors'
import { hasWebGL2, initialView, load3DView, rememberView, type ViewMode } from './ui/view3d'

export default function App() {
  const game = useGame()
  const { state, stats } = game
  const record = stats[state.difficulty]
  const tightHeader = useBattleLayout() === 'landscape' && state.phase !== 'setup'
  const [view, setViewState] = useState(initialView)
  const [webgl2] = useState(hasWebGL2)
  const view3d = view === '3d'
  const battle3d = view3d && state.phase !== 'setup'
  // Last shot id whose 3D shell has landed; null while the 3D scene isn't mounted.
  const [landed3d, setLanded3d] = useState<number | null>(null)
  const lastShotId = state.log.length ? state.log[state.log.length - 1].id : 0
  const shellsInFlight = landed3d !== null && landed3d < lastShotId
  const setView = (next: ViewMode) => {
    rememberView(next)
    setViewState(next)
  }

  const [colors, setColors] = useState(loadColors)
  const fleetColors = useMemo<FleetColorsApi>(
    () => ({
      colors,
      setColor: (player, color) =>
        setColors((prev) => {
          const next = { ...prev, [player]: color }
          saveColors(next)
          return next
        }),
    }),
    [colors],
  )

  const [settings, setSettings] = useState(loadSettings)
  const settingsApi = useMemo<SettingsApi>(
    () => ({
      settings,
      update: (patch) =>
        setSettings((prev) => {
          const next = { ...prev, ...patch }
          saveSettings(next)
          return next
        }),
    }),
    [settings],
  )
  useEffect(() => setSoundEnabled(settings.sound), [settings.sound])
  useEffect(installSoundUnlock, [])

  useEffect(() => {
    if (view3d && webgl2) void load3DView().catch(() => {})
  }, [view3d, webgl2])

  return (
    <MotionConfig reducedMotion="user">
      <SettingsContext.Provider value={settingsApi}>
        <FleetColorsContext.Provider value={fleetColors}>
          <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-slate-950 to-sky-950 text-slate-100">
            <header
              className={`${battle3d ? 'relative z-10' : ''} mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-[max(0.75rem,env(safe-area-inset-left))] sm:px-4 ${tightHeader ? 'py-1.5' : 'pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:py-5'}`}
            >
              <h1 className="text-2xl font-black tracking-tight text-sky-100">
                <span aria-hidden="true">⚓ </span>Battleship
              </h1>
              <div className="flex items-center gap-3 text-sm">
                <span className="rounded-full border border-slate-700 px-3 py-1 capitalize text-slate-300">
                  {state.difficulty} AI &middot; {record.wins}W / {record.losses}L
                </span>
                {state.phase !== 'setup' && (
                  <GameMenu
                    game={game}
                    viewSwitch={
                      view3d
                        ? { label: '2D view', onClick: () => setView('2d') }
                        : webgl2
                          ? { label: '3D view', onClick: () => setView('3d') }
                          : undefined
                    }
                  />
                )}
              </div>
            </header>
            <main className="mx-auto max-w-5xl px-[max(0.75rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-12">
              {state.phase === 'setup' ? (
                <SetupScreen game={game} />
              ) : view3d ? (
                <Battle3DLoader game={game} onExit={() => setView('2d')} onLanded={setLanded3d} />
              ) : (
                <GameScreen game={game} />
              )}
            </main>
            <GameOverModal
              key={state.phase === 'gameOver' ? 'over' : 'active'}
              game={game}
              hold={shellsInFlight}
            />
          </div>
        </FleetColorsContext.Provider>
      </SettingsContext.Provider>
    </MotionConfig>
  )
}
