import type { RuleSet, ShotEvent } from '../engine/types'
import { describeShot } from './describeShot'

/** The most recent shots, newest first. */
export function ShotLog({
  log,
  rules,
  limit,
  id,
  className = '',
}: {
  log: ShotEvent[]
  rules: RuleSet
  limit?: number
  id?: string
  className?: string
}) {
  return (
    <ol id={id} className={`space-y-0.5 text-xs ${className}`} aria-label="Battle log">
      {log
        .slice(limit ? -limit : 0)
        .reverse()
        .map((e) => (
          <li key={e.id}>
            <span className={e.by === 'human' ? 'text-sky-300' : 'text-rose-300'}>
              {e.by === 'human' ? 'You' : 'Enemy'}
            </span>{' '}
            {describeShot(e, rules).text}
          </li>
        ))}
    </ol>
  )
}
