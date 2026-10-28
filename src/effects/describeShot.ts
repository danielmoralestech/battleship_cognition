import { coordLabel } from '../engine/board'
import { shipSpec } from '../engine/rules'
import type { RuleSet, ShotEvent } from '../engine/types'

export type Tone = 'miss' | 'hit' | 'sunk-good' | 'sunk-bad'

export function describeShot(event: ShotEvent, rules: RuleSet): { text: string; tone: Tone } {
  const label = coordLabel(event.coord)
  const you = event.by === 'human'
  if (event.result === 'sunk' && event.sunkShip) {
    const name = shipSpec(rules, event.sunkShip).name
    return you
      ? { text: `${label}: You sank the enemy ${name}!`, tone: 'sunk-good' }
      : { text: `${label}: The enemy sank your ${name}!`, tone: 'sunk-bad' }
  }
  if (event.result === 'hit') {
    return { text: you ? `${label}: Direct hit!` : `${label}: You've been hit!`, tone: 'hit' }
  }
  return { text: you ? `${label}: Miss.` : `${label}: The enemy missed.`, tone: 'miss' }
}
