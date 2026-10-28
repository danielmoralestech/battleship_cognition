import { motion, useAnimate } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import type { ShotEvent } from '../engine/types'

/** Shakes its children when a new hit/sunk event lands on this board. */
export function ImpactShake({ event, children }: { event: ShotEvent | null; children: ReactNode }) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    if (!event || event.result === 'miss' || !scope.current) return
    const amp = event.result === 'sunk' ? 8 : 4
    animate(
      scope.current,
      { x: [0, -amp, amp, -amp / 2, amp / 2, 0] },
      { duration: event.result === 'sunk' ? 0.5 : 0.3 },
    )
  }, [event, animate, scope])

  return (
    <motion.div ref={scope} className="w-full">
      {children}
    </motion.div>
  )
}
