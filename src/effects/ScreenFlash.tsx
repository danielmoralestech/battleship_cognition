import { motion } from 'motion/react'
import { useState } from 'react'
import type { ShotEvent } from '../engine/types'
import { SHELL_MS } from './timing'

/** Brief full-screen flash when a ship goes down. */
export function ScreenFlash({ event }: { event: ShotEvent | null }) {
  const [mountId] = useState(event?.id)
  if (!event || event.result !== 'sunk' || event.id === mountId) return null
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return (
    <motion.div
      key={event.id}
      aria-hidden="true"
      data-fx="sink-flash"
      className="pointer-events-none fixed inset-0 z-10 bg-orange-200"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, reduced ? 0.1 : 0.3, 0] }}
      transition={{ duration: 0.6, delay: SHELL_MS / 1000, times: [0, 0.15, 1] }}
    />
  )
}
