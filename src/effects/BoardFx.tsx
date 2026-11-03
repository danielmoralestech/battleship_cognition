import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { Coord, ShotEvent } from '../engine/types'
import { ParticleEngine, explosion, shell, splash } from './particles'
import { SHELL_MS } from './timing'

interface BoardFxProps {
  /** Latest shot fired at this board. */
  event: ShotEvent | null
  /** Shells come from below for the enemy board and from above for yours. */
  side: 'enemy' | 'mine'
  gridRef: RefObject<HTMLDivElement | null>
  /** Cells of the ship sunk by `event`, if any. */
  sunkCells: Coord[]
  /** Radar sweep over the board: blue while you aim, red while the enemy does. */
  sweep?: 'scan' | 'threat' | null
  children: ReactNode
}

/** Canvas particle layer and radar sweep over a board; the grid underneath stays interactive. */
export function BoardFx({ event, side, gridRef, sunkCells, sweep, children }: BoardFxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useRef<ParticleEngine | null>(null)
  const played = useRef(event?.id)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fx = new ParticleEngine(canvas)
    engine.current = fx
    return () => {
      fx.destroy()
      engine.current = null
    }
  }, [])

  useEffect(() => {
    const fx = engine.current
    const grid = gridRef.current
    const canvas = canvasRef.current
    if (!event || event.id === played.current || !fx || !grid || !canvas) return
    played.current = event.id
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const origin = canvas.getBoundingClientRect()
    const centre = (c: Coord) => {
      const el = grid.querySelector(`[data-row="${c.row}"][data-col="${c.col}"]`)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: r.left - origin.left + r.width / 2,
        y: r.top - origin.top + r.height / 2,
        s: r.width / 32,
      }
    }
    const target = centre(event.coord)
    if (!target) return
    const { x, y, s } = target
    fx.emit(shell(fx.width / 2, side === 'enemy' ? fx.height : 0, x, y, s, SHELL_MS / 1000))
    fx.after(SHELL_MS, () => {
      if (event.result === 'miss') {
        fx.emit(splash(x, y, s))
        return
      }
      fx.emit(explosion(x, y, s, event.result === 'sunk'))
      if (event.result !== 'sunk') return
      sunkCells.forEach((c, i) => {
        const p = centre(c)
        if (p) fx.after(120 + i * 90, () => fx.emit(explosion(p.x, p.y, p.s, true)))
      })
    })
  }, [event, side, gridRef, sunkCells])

  return (
    <div className="relative mx-auto w-full max-w-[26rem]">
      {children}
      {sweep && (
        <div
          aria-hidden="true"
          data-fx={`radar-${sweep}`}
          className={`radar-sweep ${sweep === 'threat' ? 'radar-threat' : ''}`}
        />
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
      />
    </div>
  )
}
