import type { ShipType } from '../engine/types'

export const SHIP_COLORS: Record<ShipType, string> = {
  carrier: 'bg-slate-400',
  battleship: 'bg-zinc-400',
  cruiser: 'bg-stone-400',
  submarine: 'bg-gray-400',
  destroyer: 'bg-neutral-400',
}
