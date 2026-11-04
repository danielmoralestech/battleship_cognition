import { describe, expect, it } from 'vitest'
import {
  ember,
  explosion,
  firework,
  shell,
  shellAngle,
  shellPosition,
  splash,
  step,
} from './particles'

const fixed = () => 0.5

describe('particles', () => {
  it('flies a shell along an arc from start to target', () => {
    const p = shell(0, 100, 100, 100, 1, 1)
    expect(shellPosition(p, 0)).toEqual({ x: 0, y: 100 })
    expect(shellPosition(p, 1)).toEqual({ x: 100, y: 100 })
    expect(shellPosition(p, 0.5).y).toBeLessThan(100)
    const [moved] = step([p], 0.5)
    expect(moved.x).toBeCloseTo(50)
  })

  it('points the shell along its flight path', () => {
    const p = shell(0, 100, 100, 100, 1, 1)
    expect(shellAngle(p, 0)).toBeLessThan(0)
    expect(shellAngle(p, 0.5)).toBeCloseTo(0)
    expect(shellAngle(p, 1)).toBeGreaterThan(0)
    const down = shell(50, 0, 50, 100, 1, 1)
    expect(shellAngle(down, 0.9)).toBeCloseTo(Math.PI / 2, 0)
  })

  it('removes particles once their life is over', () => {
    const ps = splash(10, 10, 1, fixed)
    expect(ps.length).toBeGreaterThan(0)
    expect(step(ps, 0.1).length).toBe(ps.length)
    expect(step(ps, 5)).toEqual([])
  })

  it('makes sinking explosions bigger than hits', () => {
    expect(explosion(0, 0, 1, true, fixed).length).toBeGreaterThan(
      explosion(0, 0, 1, false, fixed).length,
    )
  })

  it('applies gravity and drag', () => {
    const [drop] = splash(0, 0, 1, fixed).filter((p) => p.kind === 'drop')
    const vy = drop.vy
    step([drop], 0.1)
    expect(drop.vy).toBeGreaterThan(vy)
  })

  it('spawns fireworks and embers inside the area', () => {
    expect(firework(50, 50, 1, fixed).every((p) => p.x === 50 && p.y === 50)).toBe(true)
    const e = ember(200, 100, fixed)
    expect(e.x).toBe(100)
    expect(e.vy).toBeLessThan(0)
  })
})
