import type { RuleSet, ShipSpec } from './types'

export const STANDARD_FLEET: ShipSpec[] = [
  { type: 'carrier', name: 'Carrier', length: 5 },
  { type: 'battleship', name: 'Battleship', length: 4 },
  { type: 'cruiser', name: 'Cruiser', length: 3 },
  { type: 'submarine', name: 'Submarine', length: 3 },
  { type: 'destroyer', name: 'Destroyer', length: 2 },
]

export const STANDARD_RULES: RuleSet = {
  gridSize: 10,
  fleet: STANDARD_FLEET,
  allowTouching: true,
  announceSinks: true,
  extraShotOnHit: false,
}

export function shipSpec(rules: RuleSet, type: ShipSpec['type']): ShipSpec {
  const spec = rules.fleet.find((s) => s.type === type)
  if (!spec) throw new Error(`Ship type ${type} is not in this fleet`)
  return spec
}
