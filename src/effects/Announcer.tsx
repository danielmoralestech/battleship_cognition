import { AnimatePresence, motion } from 'motion/react'
import type { RuleSet, ShotEvent } from '../engine/types'
import { describeShot, type Tone } from './describeShot'

const TONE_CLASSES: Record<Tone, string> = {
  miss: 'bg-slate-800/90 text-slate-200 border-slate-600',
  hit: 'bg-orange-600/90 text-white border-orange-300',
  'sunk-good': 'bg-emerald-600/95 text-white border-emerald-300',
  'sunk-bad': 'bg-red-700/95 text-white border-red-300',
}

/** Animated banner announcing the latest shot. */
export function Announcer({
  event,
  rules,
  compact,
}: {
  event: ShotEvent | null
  rules: RuleSet
  /** Narrow column: lets the banner wrap onto several lines. */
  compact?: boolean
}) {
  const message = event ? describeShot(event, rules) : null
  return (
    <div
      className={`flex items-center justify-center ${compact ? 'min-h-12' : 'h-12'}`}
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {event && message && (
          <motion.div
            key={event.id}
            className={`border font-semibold shadow-lg ${compact ? 'rounded-xl px-3 py-1.5 text-xs' : 'rounded-full px-5 py-2 text-sm'} ${TONE_CLASSES[message.tone]}`}
            initial={{ y: -12, opacity: 0, scale: message.tone.startsWith('sunk') ? 0.6 : 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
