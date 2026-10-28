import type { RuleSet, ShipType } from '../engine/types'

export function FleetStatus({
  title,
  rules,
  sunk,
}: {
  title: string
  rules: RuleSet
  sunk: ShipType[]
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-300">{title}</h3>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {rules.fleet.map((spec) => {
          const isSunk = sunk.includes(spec.type)
          return (
            <li
              key={spec.type}
              className={isSunk ? 'text-red-400 line-through' : 'text-slate-200'}
              aria-label={`${spec.name}${isSunk ? ' sunk' : ''}`}
            >
              {spec.name} ({spec.length})
            </li>
          )
        })}
      </ul>
    </div>
  )
}
