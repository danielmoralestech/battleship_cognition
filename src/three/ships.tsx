import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from 'three'
import type { PlacedShip, ShipType } from '../engine/types'
import { type BoardPlacement, shipTransform } from './geometry'
import { waveHeight } from './water'

type MaterialKey = 'hull' | 'deck' | 'super' | 'dark' | 'team'

interface Part {
  geometry: BufferGeometry
  material: MaterialKey
  position: [number, number, number]
}

const HULL_COLORS: Record<ShipType, string> = {
  carrier: '#64748b',
  battleship: '#71717a',
  cruiser: '#78716c',
  submarine: '#334155',
  destroyer: '#737373',
}

const SHARED = {
  deck: new MeshStandardMaterial({ color: '#3f3f46', roughness: 0.9, flatShading: true }),
  super: new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.7, flatShading: true }),
  dark: new MeshStandardMaterial({ color: '#1e293b', roughness: 0.8, flatShading: true }),
}
// Wrecks: a scorched, ember-lit hull that still reads against dark water, over a red footprint.
const WRECK_HULL = new MeshStandardMaterial({
  color: '#7c2d12',
  emissive: '#9a3412',
  emissiveIntensity: 0.45,
  roughness: 1,
  flatShading: true,
})
const WRECK_TOP = new MeshStandardMaterial({ color: '#57534e', roughness: 1, flatShading: true })
const WRECK_FILL = new MeshBasicMaterial({
  color: '#dc2626',
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
})
const WRECK_EDGE = new MeshBasicMaterial({ color: '#f87171', transparent: true, depthWrite: false })
const footprint = new PlaneGeometry(1, 1)
footprint.rotateX(-Math.PI / 2)
const EDGE = 0.06
const hullMaterials = new Map<ShipType, MeshStandardMaterial>()
const hullMaterial = (type: ShipType) => {
  let m = hullMaterials.get(type)
  if (!m) {
    m = new MeshStandardMaterial({
      color: HULL_COLORS[type],
      roughness: 0.6,
      metalness: 0.2,
      flatShading: true,
    })
    hullMaterials.set(type, m)
  }
  return m
}

const teamMaterials = new Map<string, MeshStandardMaterial>()
/** Fleet accent paint; dulled on wrecks so they stay charred but still show whose they were. */
const teamMaterial = (color: string, wreck: boolean) => {
  const key = `${color}:${wreck}`
  let m = teamMaterials.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.55, flatShading: true })
    if (wreck) m.color.multiplyScalar(0.55)
    teamMaterials.set(key, m)
  }
  return m
}

/** Pointed-bow hull outline, extruded upwards; x runs stern to bow. */
function hullGeometry(length: number, halfWidth: number, height: number) {
  const s = length / 2
  const bow = Math.min(0.7, length * 0.25)
  const shape = new Shape()
  shape.moveTo(-s, -halfWidth * 0.8)
  shape.lineTo(s - bow, -halfWidth)
  shape.lineTo(s, 0)
  shape.lineTo(s - bow, halfWidth)
  shape.lineTo(-s, halfWidth * 0.8)
  shape.closePath()
  const g = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -0.12, 0)
  return g
}

const box = (x: number, y: number, z: number) => new BoxGeometry(x, y, z)
const cyl = (r: number, h: number, seg = 8) => new CylinderGeometry(r, r, h, seg)

function turret(x: number, y: number, parts: Part[], forward = 1) {
  parts.push({ geometry: cyl(0.15, 0.1), material: 'super', position: [x, y, 0] })
  parts.push({ geometry: cyl(0.075, 0.03), material: 'team', position: [x, y + 0.06, 0] })
  const barrel = box(0.34, 0.035, 0.035)
  barrel.translate(0.17 * forward, 0, 0)
  parts.push({ geometry: barrel, material: 'dark', position: [x + 0.05 * forward, y + 0.02, 0.05] })
  parts.push({
    geometry: barrel,
    material: 'dark',
    position: [x + 0.05 * forward, y + 0.02, -0.05],
  })
}

function buildParts(type: ShipType, cells: number): Part[] {
  const L = cells * 0.94
  const s = L / 2
  const parts: Part[] = []
  if (type === 'submarine') {
    const hull = new CapsuleGeometry(0.19, L - 0.45, 4, 10)
    hull.rotateZ(Math.PI / 2)
    hull.scale(1, 0.8, 1)
    parts.push({ geometry: hull, material: 'hull', position: [0, 0.02, 0] })
    parts.push({ geometry: box(0.45, 0.26, 0.14), material: 'hull', position: [0.25, 0.25, 0] })
    // Light rims under the accents keep dark fleet colors visible on the dark hull.
    parts.push({ geometry: box(0.5, 0.04, 0.18), material: 'super', position: [0.25, 0.32, 0] })
    parts.push({ geometry: box(0.47, 0.05, 0.15), material: 'team', position: [0.25, 0.33, 0] })
    parts.push({ geometry: box(L * 0.72, 0.05, 0.4), material: 'super', position: [0, -0.01, 0] })
    parts.push({ geometry: box(L * 0.7, 0.03, 0.41), material: 'team', position: [0, 0.02, 0] })
    parts.push({ geometry: cyl(0.015, 0.25, 4), material: 'dark', position: [0.32, 0.5, 0] })
    return parts
  }
  const halfWidth =
    type === 'carrier' ? 0.38 : type === 'battleship' ? 0.34 : type === 'cruiser' ? 0.3 : 0.25
  parts.push({ geometry: hullGeometry(L, halfWidth, 0.32), material: 'hull', position: [0, 0, 0] })
  parts.push({
    geometry: box(L * 0.82, 0.035, halfWidth * 2.05),
    material: 'team',
    position: [-0.05, 0.0, 0],
  })
  const bowBand = s - Math.min(0.7, L * 0.25) - 0.12
  if (type === 'carrier') {
    parts.push({ geometry: box(L * 1.02, 0.05, 0.9), material: 'deck', position: [0.05, 0.23, 0] })
    parts.push({
      geometry: box(L * 0.85, 0.008, 0.03),
      material: 'team',
      position: [0.05, 0.26, 0],
    })
    parts.push({ geometry: box(0.1, 0.05, 0.92), material: 'team', position: [bowBand, 0.24, 0] })
    parts.push({ geometry: box(0.7, 0.34, 0.16), material: 'super', position: [0.2, 0.42, 0.33] })
    parts.push({ geometry: cyl(0.02, 0.3, 4), material: 'dark', position: [0.2, 0.72, 0.33] })
    for (const x of [-1.4, -0.9, 1.1]) {
      parts.push({ geometry: box(0.28, 0.04, 0.24), material: 'dark', position: [x, 0.28, -0.15] })
    }
    return parts
  }
  parts.push({
    geometry: box(L * 0.8, 0.04, halfWidth * 1.4),
    material: 'deck',
    position: [-0.1, 0.21, 0],
  })
  parts.push({
    geometry: box(0.1, 0.05, halfWidth * 1.45),
    material: 'team',
    position: [bowBand, 0.215, 0],
  })
  const bridgeX = type === 'destroyer' ? 0 : 0.05
  parts.push({
    geometry: box(0.45, 0.22, halfWidth * 1.1),
    material: 'super',
    position: [bridgeX, 0.33, 0],
  })
  parts.push({
    geometry: box(0.26, 0.16, halfWidth * 0.8),
    material: 'super',
    position: [bridgeX + 0.04, 0.51, 0],
  })
  parts.push({ geometry: cyl(0.018, 0.35, 4), material: 'dark', position: [bridgeX, 0.75, 0] })
  const funnels = type === 'cruiser' ? [-0.4, -0.75] : type === 'battleship' ? [-0.45] : [-0.35]
  for (const x of funnels) {
    parts.push({ geometry: cyl(0.08, 0.32), material: 'dark', position: [x, 0.38, 0] })
    parts.push({ geometry: cyl(0.085, 0.06), material: 'team', position: [x, 0.49, 0] })
  }
  turret(s - 0.6, 0.26, parts)
  if (type === 'battleship') turret(s - 1.05, 0.33, parts)
  if (type !== 'destroyer') turret(-s + 0.45, 0.26, parts, -1)
  return parts
}

const partsCache = new Map<string, Part[]>()
function shipParts(type: ShipType, cells: number) {
  const key = `${type}:${cells}`
  let parts = partsCache.get(key)
  if (!parts) {
    parts = buildParts(type, cells)
    partsCache.set(key, parts)
  }
  return parts
}

export function ShipModel({
  ship,
  board,
  size,
  sunk,
  team,
  waveAmp,
}: {
  ship: PlacedShip
  board: BoardPlacement
  size: number
  sunk: boolean
  team: string
  waveAmp: number
}) {
  const group = useRef<Group>(null)
  const sink = useRef(sunk ? 1 : 0)
  const { x, z, yaw } = shipTransform(board, ship, size)
  const parts = useMemo(() => shipParts(ship.type, ship.length), [ship.type, ship.length])
  const phase = (ship.origin.row * 7 + ship.origin.col * 3) % 10

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    sink.current = sunk ? Math.min(1, sink.current + dt * 0.6) : 0
    const k = sink.current
    // Settles low, listing and bow-down, but stays above the surface so it is recognisable.
    g.position.set(x, waveHeight(x, z, t, waveAmp) * 0.8 - k * 0.08, z)
    g.rotation.set(
      Math.sin(t * 1.2 + phase) * waveAmp * 0.5 + k * 0.22,
      yaw,
      Math.sin(t * 0.9 + phase) * waveAmp * 0.25 - k * 0.1,
    )
  })

  const material = (key: MaterialKey) =>
    key === 'team'
      ? teamMaterial(team, sunk)
      : sunk
        ? key === 'hull'
          ? WRECK_HULL
          : WRECK_TOP
        : key === 'hull'
          ? hullMaterial(ship.type)
          : SHARED[key]

  return (
    <>
      <group ref={group} position={[x, 0, z]} rotation={[0, yaw, 0, 'YXZ']}>
        {parts.map((p, i) => (
          <mesh
            key={i}
            geometry={p.geometry}
            material={material(p.material)}
            position={p.position}
          />
        ))}
      </group>
      {sunk && <WreckFootprint x={x} z={z} yaw={yaw} length={ship.length} />}
    </>
  )
}

/** Red outline over the sunk ship's cells, like the 2D board's sunk marking. */
function WreckFootprint({
  x,
  z,
  yaw,
  length,
}: {
  x: number
  z: number
  yaw: number
  length: number
}) {
  const w = length - 0.12
  const d = 0.88
  const edges: [number, number, number, number][] = [
    [0, -d / 2, w, EDGE],
    [0, d / 2, w, EDGE],
    [-w / 2, 0, EDGE, d],
    [w / 2, 0, EDGE, d],
  ]
  return (
    <group position={[x, 0.09, z]} rotation={[0, yaw, 0]}>
      <mesh geometry={footprint} material={WRECK_FILL} scale={[w, 1, d]} renderOrder={1} />
      {edges.map(([ex, ez, sx, sz], i) => (
        <mesh
          key={i}
          geometry={footprint}
          material={WRECK_EDGE}
          position={[ex, 0.005, ez]}
          scale={[sx, 1, sz]}
          renderOrder={2}
        />
      ))}
    </group>
  )
}
