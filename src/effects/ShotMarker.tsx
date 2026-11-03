import { motion } from 'motion/react'
import type { ShotResult } from '../engine/types'
import { SHELL_MS } from './timing'

const LAND = { delay: SHELL_MS / 1000 }

/**
 * Marker drawn on a shot cell. With `animate` it pops in when the shell lands.
 * Hits keep burning and smoking; `lite` (mini-map) draws just the marker.
 */
export function ShotMarker({
  result,
  animate,
  lite = false,
}: {
  result: ShotResult
  animate: boolean
  lite?: boolean
}) {
  const pop = animate ? { scale: 0, opacity: 0 } : false
  if (result === 'miss') {
    return (
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.span
          className="size-[28%] rounded-full bg-sky-100/80 shadow-[0_0_6px_rgba(186,230,253,0.6)]"
          initial={pop}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, ...LAND }}
        />
      </span>
    )
  }

  const sunk = result === 'sunk'
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {!lite && (
        <motion.span
          data-fx={sunk ? 'smoke' : 'fire'}
          className="absolute inset-0 flex items-center justify-center"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ ...LAND, duration: 0.3 }}
        >
          {!sunk && <span className="fx-flame" />}
          <span className={sunk ? 'fx-smoke fx-smoke-late' : 'fx-smoke'} />
        </motion.span>
      )}
      <motion.span
        className={`relative size-[45%] rounded-full ${sunk ? 'bg-red-900 ring-2 ring-red-500/70' : 'bg-red-500 shadow-[0_0_8px_1px_rgba(251,146,60,0.8)]'}`}
        initial={pop}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 12, ...LAND }}
      />
    </span>
  )
}
