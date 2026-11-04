import { describe, expect, it } from 'vitest'
import {
  boardPlacements,
  cameraPosition,
  cellToWorld,
  framingDistance,
  framingFor,
  shipTransform,
  worldToCell,
} from './geometry'

describe('3D board geometry', () => {
  const boards = boardPlacements('wide')

  it('maps every cell centre back to the same cell', () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const [x, z] = cellToWorld(boards.ai, { row, col }, 10)
        expect(worldToCell(boards.ai, x, z, 10)).toEqual({ row, col })
        expect(worldToCell(boards.ai, x + 0.49, z - 0.49, 10)).toEqual({ row, col })
      }
    }
  })

  it('returns null outside the board', () => {
    const [x, z] = cellToWorld(boards.ai, { row: 0, col: 0 }, 10)
    expect(worldToCell(boards.ai, x - 1, z, 10)).toBeNull()
    expect(worldToCell(boards.ai, x, z + 10, 10)).toBeNull()
  })

  it('keeps the boards apart in both layouts', () => {
    for (const layout of ['wide', 'portrait'] as const) {
      const b = boardPlacements(layout)
      expect(Math.hypot(b.ai.x - b.human.x, b.ai.z - b.human.z)).toBeGreaterThan(10)
    }
    expect(boardPlacements('portrait').ai.z).toBeLessThan(boardPlacements('portrait').human.z)
  })

  it('centres ships on their cells', () => {
    const ship = {
      type: 'cruiser',
      origin: { row: 2, col: 3 },
      orientation: 'vertical',
      length: 3,
    } as const
    const t = shipTransform(boards.human, ship, 10)
    expect([t.x, t.z]).toEqual(cellToWorld(boards.human, { row: 3, col: 3 }, 10))
  })

  it('points the bow the way the ship faces', () => {
    const ship = {
      type: 'cruiser',
      origin: { row: 2, col: 3 },
      orientation: 'horizontal',
      length: 3,
    } as const
    expect(shipTransform(boards.human, ship, 10).yaw).toBe(0)
    expect(shipTransform(boards.human, { ...ship, facing: 'west' }, 10).yaw).toBe(Math.PI)
    const vertical = { ...ship, orientation: 'vertical' } as const
    expect(shipTransform(boards.human, vertical, 10).yaw).toBe(Math.PI / 2)
    expect(shipTransform(boards.human, { ...vertical, facing: 'south' }, 10).yaw).toBe(-Math.PI / 2)
  })

  it('moves the camera back on narrow screens so the whole board fits', () => {
    const framing = framingFor('portrait', 'ai', boardPlacements('portrait'), 10)
    const phone = framingDistance(framing, 390 / 664, 40)
    const desktop = framingDistance(framing, 16 / 9, 40)
    expect(phone).toBeGreaterThan(desktop)
    const [, y, z] = cameraPosition(framing, phone)
    expect(y).toBeGreaterThan(0)
    expect(z).toBeGreaterThan(framing.centerZ)
  })
})
