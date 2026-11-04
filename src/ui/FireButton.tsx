import { coordLabel } from '../engine/board'
import type { Aim } from './aim'

/** The explicit Fire button shown while "Aim before firing" is on. */
export function FireButton({ aim, className = '' }: { aim: Aim; className?: string }) {
  const label = aim.aimed ? coordLabel(aim.aimed) : null
  return (
    <>
      <button
        type="button"
        className={`btn-primary disabled:opacity-50 ${className}`}
        disabled={!label}
        onClick={aim.fireAimed}
      >
        {label ? `Fire at ${label}` : 'Tap a square to aim'}
      </button>
      <p className="sr-only" aria-live="assertive">
        {label ? `${label} aimed. Activate again to fire.` : ''}
      </p>
    </>
  )
}
