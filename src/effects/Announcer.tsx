import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import type { RuleSet, ShotEvent } from '../engine/types'
import { ShotLog } from './ShotLog'
import { describeShot, type Tone } from './describeShot'

const TONE_CLASSES: Record<Tone, string> = {
  miss: 'bg-slate-800/90 text-slate-200 border-slate-600',
  hit: 'bg-orange-600/90 text-white border-orange-300',
  'sunk-good': 'bg-emerald-600/95 text-white border-emerald-300',
  'sunk-bad': 'bg-red-700/95 text-white border-red-300',
}

/** Animated banner announcing the latest shot; tapping it drops down the full battle log. */
export function Announcer({
  event,
  log,
  rules,
  compact,
}: {
  event: ShotEvent | null
  log: ShotEvent[]
  rules: RuleSet
  /** Narrow column: lets the banner wrap onto several lines. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const message = event ? describeShot(event, rules) : null
  const isOpen = open && !!message && log.length > 0

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  return (
    <div
      className={`pointer-events-none relative flex items-center justify-center ${compact ? 'min-h-12' : 'h-12'}`}
    >
      <p className="sr-only" aria-live="polite">
        {message?.text}
      </p>
      {event && message && (
        <button
          ref={button}
          type="button"
          className={`pointer-events-auto relative cursor-pointer outline-offset-2 ${isOpen ? 'z-[21]' : ''} focus-visible:outline-2 focus-visible:outline-sky-300 ${compact ? 'rounded-xl' : 'rounded-full'}`}
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={event.id}
              className={`flex items-center gap-1.5 border font-semibold shadow-lg ${compact ? 'rounded-xl px-3 py-1.5 text-xs' : 'rounded-full px-5 py-2 text-sm'} ${TONE_CLASSES[message.tone]}`}
              initial={{ y: -12, opacity: 0, scale: message.tone.startsWith('sunk') ? 0.6 : 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <span>{message.text}</span>
              <span
                aria-hidden="true"
                className={`text-[0.7em] opacity-80 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              >
                ▼
              </span>
            </motion.span>
          </AnimatePresence>
          <span className="sr-only"> Battle log</span>
        </button>
      )}
      {isOpen && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-20"
            data-testid="battle-log-backdrop"
            onClick={() => setOpen(false)}
          />
          <motion.div
            id={panelId}
            className="pointer-events-auto absolute top-full left-1/2 z-20 mt-1 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-left shadow-2xl backdrop-blur"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-300">
              Battle log · {log.length} {log.length === 1 ? 'shot' : 'shots'}
            </p>
            <ShotLog
              log={log}
              rules={rules}
              className="max-h-[min(50dvh,20rem)] overflow-y-auto text-slate-300"
            />
          </motion.div>
        </>
      )}
    </div>
  )
}
