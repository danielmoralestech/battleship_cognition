import { motion } from 'motion/react'
import type { ShotResult } from '../engine/types'

const SPARKS = [0, 60, 120, 180, 240, 300]

/** Marker drawn on a shot cell; plays an entrance effect when `animate` is set. */
export function ShotMarker({ result, animate }: { result: ShotResult; animate: boolean }) {
  if (result === 'miss') {
    return (
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {animate && (
          <motion.span
            className="absolute size-full rounded-full border-2 border-sky-200/80"
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
        <motion.span
          className="size-[28%] rounded-full bg-sky-100/80"
          initial={animate ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        />
      </span>
    )
  }

  const sunk = result === 'sunk'
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {animate &&
        SPARKS.map((deg) => (
          <motion.span
            key={deg}
            className="absolute size-[18%] rounded-full bg-amber-300"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos((deg * Math.PI) / 180) * 22,
              y: Math.sin((deg * Math.PI) / 180) * 22,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        ))}
      {animate && (
        <motion.span
          className="absolute size-full rounded-md bg-orange-300"
          initial={{ opacity: 0.9, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.45 }}
        />
      )}
      <motion.span
        className={`size-[55%] rounded-full ${sunk ? 'bg-red-700 shadow-[0_0_10px_2px_rgba(248,113,113,0.6)]' : 'bg-red-500 shadow-[0_0_8px_1px_rgba(251,146,60,0.7)]'}`}
        initial={animate ? { scale: 0 } : false}
        animate={sunk ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={
          sunk
            ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
            : { type: 'spring', stiffness: 500, damping: 12 }
        }
      />
    </span>
  )
}
