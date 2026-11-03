import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { ParticleEngine, ember, firework } from './particles'

const EMBER_SECONDS = 10

/** Fireworks on victory; embers and a red vignette on defeat. */
export function Celebration({ won }: { won: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || reduced) return
    const fx = new ParticleEngine(canvas)
    const s = Math.min(1.4, Math.max(0.8, fx.width / 500))
    if (won) {
      for (let i = 0; i < 10; i++) {
        fx.after(400 + i * 320, () =>
          fx.emit(
            firework(
              fx.width * (0.15 + Math.random() * 0.7),
              fx.height * (0.1 + Math.random() * 0.4),
              s,
            ),
          ),
        )
      }
      return () => fx.destroy()
    }
    const id = setInterval(
      () => fx.emit([ember(fx.width, fx.height), ember(fx.width, fx.height)]),
      120,
    )
    const stop = setTimeout(() => clearInterval(id), EMBER_SECONDS * 1000)
    return () => {
      clearInterval(id)
      clearTimeout(stop)
      fx.destroy()
    }
  }, [won, reduced])

  return (
    <>
      {!won && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(127_29_29/0.5))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        />
      )}
      <canvas
        ref={ref}
        aria-hidden="true"
        data-fx={won ? 'fireworks' : 'embers'}
        className="pointer-events-none fixed inset-0 z-30 size-full"
      />
    </>
  )
}
