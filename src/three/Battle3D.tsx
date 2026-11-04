import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { isShipSunk } from '../engine/board'
import { getTargetView } from '../engine/view'
import type { PlayerId } from '../engine/types'
import { Announcer } from '../effects'
import type { GameApi } from '../hooks/useGame'
import { useBattleLayout, useMediaQuery } from '../hooks/useMediaQuery'
import { useAim } from '../ui/aim'
import { FireButton } from '../ui/FireButton'
import { FleetStatus } from '../ui/FleetStatus'
import { useTeamHex } from '../ui/teamColors'
import { CAMERA_FOV, Scene, type HudInsets } from './Scene'

const MAX_DPR = 2

/** Experimental three.js battle view (`?view=3d`). Fleet placement stays on the 2D screen. */
export default function Battle3D({
  game,
  onExit,
  onLanded,
}: {
  game: GameApi
  onExit: () => void
  onLanded?: (id: number | null) => void
}) {
  const { state, fire } = game
  const teamHex = useTeamHex()
  const teams = { human: teamHex('human'), ai: teamHex('ai') }
  const layout = useBattleLayout()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [focus, setFocus] = useState<PlayerId>('ai')
  const aim = useAim(state, fire)
  const [contextLost, setContextLost] = useState(false)
  const [showFps] = useState(() => new URLSearchParams(window.location.search).has('fps'))
  const fpsEl = useRef<HTMLSpanElement>(null)
  const topHud = useRef<HTMLDivElement>(null)
  const bottomHud = useRef<HTMLDivElement>(null)
  const insets = useRef<HudInsets>({ top: 0, bottom: 0 })
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, MAX_DPR))

  useLayoutEffect(() => {
    const measure = () => {
      insets.current = {
        top: topHud.current?.getBoundingClientRect().bottom ?? 0,
        bottom:
          window.innerHeight -
          (bottomHud.current?.getBoundingClientRect().top ?? window.innerHeight),
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (topHud.current) ro.observe(topHud.current)
    if (bottomHud.current) ro.observe(bottomHud.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [layout])

  useEffect(() => {
    if (layout !== 'portrait') setFocus('ai')
  }, [layout])

  const { rules, boards, log } = state
  const latest = log[log.length - 1] ?? null
  const humanTurn = state.phase === 'playing' && state.turn === 'human'
  const enemyView = getTargetView(boards.ai, rules)
  const stats = (p: PlayerId) => {
    const shots = log.filter((e) => e.by === p)
    const hits = shots.filter((e) => e.result !== 'miss').length
    return {
      shots: shots.length,
      accuracy: shots.length ? Math.round((hits / shots.length) * 100) : 0,
    }
  }
  const mine = stats('human')
  const theirs = stats('ai')
  const compact = layout === 'landscape'

  return (
    <>
      <div
        className="fixed inset-0 [touch-action:manipulation]"
        role="img"
        aria-label="3D battle view: enemy waters and your fleet. Tap a cell of the enemy board to fire."
      >
        {contextLost ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">
            The 3D view lost its graphics context.{' '}
            <button type="button" className="ml-1 underline" onClick={onExit}>
              Switch to 2D
            </button>
          </p>
        ) : (
          <Canvas
            dpr={dpr}
            gl={{ antialias: dpr < 2, powerPreference: 'default', alpha: false }}
            camera={{ fov: CAMERA_FOV, near: 0.5, far: 400, position: [0, 30, 30] }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true))
            }}
          >
            <Scene
              state={state}
              fire={aim.select}
              aimed={aim.aimed}
              layout={layout}
              focus={focus}
              reduced={reduced}
              insets={insets}
              fpsEl={showFps ? fpsEl : undefined}
              teams={teams}
              onLanded={onLanded}
            />
          </Canvas>
        )}
      </div>

      <div
        ref={topHud}
        className="pointer-events-none relative z-[6] flex flex-col items-center gap-1 pb-1"
      >
        <p
          className={`font-semibold uppercase drop-shadow ${compact ? 'text-xs tracking-wide' : 'text-sm tracking-widest'} ${humanTurn ? 'text-amber-300' : 'text-slate-300'}`}
          data-testid="turn-indicator"
        >
          {state.phase === 'gameOver'
            ? 'Battle over'
            : humanTurn
              ? focus === 'ai'
                ? `Your turn: tap enemy waters to ${aim.enabled ? 'aim' : 'fire'}`
                : 'Your turn: switch to enemy waters'
              : 'Enemy is aiming...'}
        </p>
        <Announcer event={latest} log={log} rules={rules} compact={compact} />
      </div>

      <div
        ref={bottomHud}
        data-testid="hud-bottom"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-transparent px-[max(0.75rem,env(safe-area-inset-left))] pt-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div
          className={`pointer-events-auto mx-auto flex max-w-5xl items-end gap-3 ${compact ? 'justify-between' : 'flex-wrap justify-between'}`}
        >
          <div className="flex gap-4">
            <FleetStatus
              title="Enemy fleet"
              rules={rules}
              compact
              sunk={enemyView.sunkShips.map((s) => s.type)}
            />
            <FleetStatus
              title="Your fleet"
              rules={rules}
              compact
              sunk={boards.human.ships
                .filter((s) => isShipSunk(boards.human, s))
                .map((s) => s.type)}
            />
          </div>
          <p className="text-[11px] leading-tight text-slate-400">
            Your shots: {mine.shots} · {mine.accuracy}%
            <br />
            Enemy shots: {theirs.shots} · {theirs.accuracy}%
          </p>
          <div className="flex items-center gap-2">
            {showFps && (
              <span ref={fpsEl} data-testid="fps" className="font-mono text-xs text-emerald-300">
                -- fps
              </span>
            )}
            {aim.enabled && state.phase === 'playing' && (
              <FireButton aim={aim} className="px-3 py-1.5 text-xs" />
            )}
            {layout === 'portrait' && (
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                aria-pressed={focus === 'human'}
                onClick={() => setFocus((f) => (f === 'ai' ? 'human' : 'ai'))}
              >
                {focus === 'ai' ? 'Your fleet' : 'Enemy waters'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
