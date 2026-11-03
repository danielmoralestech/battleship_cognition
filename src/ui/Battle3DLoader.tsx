import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import type { GameApi } from '../hooks/useGame'
import { GameScreen } from './GameScreen'
import { hasWebGL2, load3DView } from './view3d'

const Battle3D = lazy(load3DView)

class Fallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="mx-auto mb-3 max-w-[26rem] rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-center text-xs text-amber-200"
    >
      {children}
    </p>
  )
}

/** Loads the 3D battle view on demand; falls back to the 2D screen without WebGL 2. */
export function Battle3DLoader({ game }: { game: GameApi }) {
  const [supported] = useState(hasWebGL2)
  const fallback = (reason: string) => (
    <>
      <Notice>{reason} Showing the 2D board instead.</Notice>
      <GameScreen game={game} />
    </>
  )
  if (!supported) return fallback('The 3D view needs WebGL 2, which this browser does not provide.')
  return (
    <Fallback fallback={fallback('The 3D view failed to start.')}>
      <Suspense
        fallback={<p className="py-24 text-center text-sm text-slate-400">Loading 3D view…</p>}
      >
        <Battle3D game={game} />
      </Suspense>
    </Fallback>
  )
}
