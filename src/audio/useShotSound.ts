import { useEffect, useRef } from 'react'
import type { RuleSet, ShotEvent } from '../engine/types'
import { playShot } from './sound'

/** Plays each new shot once; shots that already existed on mount (restored, view switch) stay silent. */
export function useShotSound(event: ShotEvent | null, rules: RuleSet, flightMs: number) {
  const played = useRef(event?.id ?? 0)
  useEffect(() => {
    if (!event) {
      played.current = 0
      return
    }
    if (event.id === played.current) return
    played.current = event.id
    playShot(event, rules, flightMs)
  }, [event, rules, flightMs])
}
