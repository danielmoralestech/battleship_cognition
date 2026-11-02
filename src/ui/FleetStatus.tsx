import type { RuleSet, ShipType } from '../engine/types'

export function FleetStatus({
  title,
  rules,
  sunk,
  compact,
}: {
  title: string
  rules: RuleSet
  sunk: ShipType[]
  /** Pips only, ship names are left to the tooltip/aria label. */
  compact?: boolean
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-300">{title}</h3>
      <ul className={`flex flex-wrap text-sm ${compact ? 'gap-2' : 'gap-x-3 gap-y-1'}`}>
        {rules.fleet.map((spec) => {
          const isSunk = sunk.includes(spec.type)
          return (
            <li
              key={spec.type}
              className={`flex items-center gap-1.5 ${isSunk ? 'text-red-400 line-through' : 'text-slate-200'}`}
              aria-label={`${spec.name}${isSunk ? ' sunk' : ''}`}
              title={`${spec.name} (${spec.length})${isSunk ? ', sunk' : ''}`}
            >
              <span className="flex gap-px" aria-hidden="true">
                {Array.from({ length: spec.length }, (_, i) => (
                  <span
                    key={i}
                    className={`size-2 rounded-[1px] ${isSunk ? 'bg-red-500/80' : 'bg-slate-300'}`}
                  />
                ))}
              </span>
              {!compact && (
                <span aria-hidden="true">
                  {spec.name} ({spec.length})
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
