import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  CanvasTexture,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three'
import { canFire } from '../engine/game'
import { isShipSunk, parseCoordKey, shipCells } from '../engine/board'
import type { Board, Coord, GameState, PlayerId, ShotEvent } from '../engine/types'
import { useShotSound } from '../audio/useShotSound'
import type { BattleLayout } from '../hooks/useMediaQuery'
import { Burst, FireField, Shell, type BurstKind, type Vec3 } from './effects'
import {
  boardPlacements,
  cameraPosition,
  cellToWorld,
  framingDistance,
  framingFor,
  shipTransform,
  worldToCell,
  type BoardPlacement,
} from './geometry'
import { ShipModel } from './ships'
import { createSkyMaterial, createWaterMaterial } from './water'

export const CAMERA_FOV = 40
const SHELL_SECONDS = 0.75

export interface HudInsets {
  /** CSS px of the canvas covered by overlaid HUD at the top and bottom. */
  top: number
  bottom: number
}

interface SceneProps {
  state: GameState
  fire: (coord: Coord) => void
  layout: BattleLayout
  focus: PlayerId
  reduced: boolean
  insets: RefObject<HudInsets>
  fpsEl?: RefObject<HTMLElement | null>
  /** Fleet accent color (hex) per player. */
  teams: Record<PlayerId, string>
  /** Reports the last shot whose shell has landed, and null on unmount. */
  onLanded?: (id: number | null) => void
}

/** Board shots without the shells still queued or in flight, so results appear when they land. */
function landedBoard(board: Board, unlanded: ShotEvent[], defender: PlayerId): Board {
  const incoming = unlanded.filter((e) => e.by !== defender)
  if (!incoming.length) return board
  const shots = { ...board.shots }
  for (const e of incoming) delete shots[`${e.coord.row},${e.coord.col}`]
  return { ...board, shots }
}

interface ActiveBurst {
  id: string
  event: number
  at: Vec3
  kind: BurstKind
  delay: number
}

const SUNK_STAGGER = 0.14

export function Scene({
  state,
  fire,
  layout,
  focus,
  reduced,
  insets,
  fpsEl,
  teams,
  onLanded,
}: SceneProps) {
  const size = state.rules.gridSize
  const placements = useMemo(() => boardPlacements(layout), [layout])
  const waveAmp = reduced ? 0.025 : 0.07
  const lastId = state.log.length ? state.log[state.log.length - 1].id : 0

  // Shots animate one at a time; anything older than mount is shown as already landed.
  const [landedId, setLandedId] = useState(lastId)
  const [bursts, setBursts] = useState<ActiveBurst[]>([])
  const shake = useRef(0)
  if (landedId > lastId) setLandedId(lastId)
  const unlanded = state.log.filter((e) => e.id > landedId)
  const pending = unlanded.find((e) => e.id === landedId + 1) ?? null
  useShotSound(pending, state.rules, reduced ? 0 : SHELL_SECONDS * 1000)
  useEffect(() => onLanded?.(landedId), [landedId, onLanded])
  useEffect(() => () => onLanded?.(null), [onLanded])

  const boards = {
    ai: landedBoard(state.boards.ai, unlanded, 'ai'),
    human: landedBoard(state.boards.human, unlanded, 'human'),
  }

  const land = (event: ShotEvent) => {
    setLandedId(event.id)
    const defender: PlayerId = event.by === 'human' ? 'ai' : 'human'
    const at = (coord: Coord): Vec3 => {
      const [x, z] = cellToWorld(placements[defender], coord, size)
      return [x, 0.25, z]
    }
    const sunkShip =
      event.result === 'sunk'
        ? state.boards[defender].ships.find((s) => s.type === event.sunkShip)
        : undefined
    // A sinking ship erupts along its whole hull, starting from the cell that was hit.
    const added: ActiveBurst[] = sunkShip
      ? shipCells(sunkShip)
          .map((c) => ({
            c,
            d: Math.abs(c.row - event.coord.row) + Math.abs(c.col - event.coord.col),
          }))
          .sort((a, b) => a.d - b.d)
          .map(({ c }, i) => ({
            id: `${event.id}:${i}`,
            event: event.id,
            at: at(c),
            kind: 'sunk',
            delay: reduced ? 0 : i * SUNK_STAGGER,
          }))
      : [
          {
            id: `${event.id}`,
            event: event.id,
            at: at(event.coord),
            kind: event.result === 'miss' ? 'splash' : 'explosion',
            delay: 0,
          },
        ]
    setBursts((b) => (b.some((x) => x.event === event.id) ? b : [...b.slice(-3), ...added]))
    if (event.result !== 'miss' && !reduced) shake.current = sunkShip ? 0.7 : 0.25
  }

  const launchPoint = (event: ShotEvent): Vec3 => {
    if (event.by === 'human') {
      const own = state.boards.human
      const ship = own.ships.find((s) => !isShipSunk(own, s)) ?? own.ships[0]
      if (ship) {
        const t = shipTransform(placements.human, ship, size)
        return [t.x, 0.6, t.z]
      }
      return [placements.human.x, 0.6, placements.human.z]
    }
    // Enemy shells come from beyond the far side of their board, so no hidden ship is revealed.
    const dx = placements.ai.x - placements.human.x
    const dz = placements.ai.z - placements.human.z
    const len = Math.hypot(dx, dz) || 1
    return [placements.ai.x + (dx / len) * 7.5, 0.6, placements.ai.z + (dz / len) * 7.5]
  }

  const humanTurn = state.phase === 'playing' && state.turn === 'human'
  // Wait for the final shell to land so the last ship isn't revealed (or wrecked) early.
  const reveal = state.phase === 'gameOver' && unlanded.length === 0

  const shipsFor = (owner: PlayerId) => {
    const board = boards[owner]
    return board.ships
      .map((ship) => ({ ship, sunk: isShipSunk(board, ship) }))
      .filter(({ sunk }) => owner === 'human' || sunk || reveal)
  }

  const shots = (['ai', 'human'] as const).flatMap((owner) =>
    Object.entries(boards[owner].shots).map(([key, result]) => {
      const coord = parseCoordKey(key)
      const [x, z] = cellToWorld(placements[owner], coord, size)
      return { x, z, result }
    }),
  )
  const shotsKey = shots.map((s) => `${s.x},${s.z},${s.result}`).join('|')
  const emitters = useMemo<Vec3[]>(
    () =>
      shotsKey
        .split('|')
        .map((s) => s.split(','))
        .filter((p) => p[2] === 'hit')
        .map((p) => [Number(p[0]), 0.3, Number(p[1])]),
    [shotsKey],
  )

  const { camera, size: canvasSize } = useThree()
  useEffect(() => {
    if (!import.meta.env.DEV) return
    // Dev/e2e hook: screen position (CSS px, viewport) of an enemy cell, for scripted taps.
    const w = window as unknown as { __battle3d?: unknown }
    w.__battle3d = {
      enemyCellToScreen(row: number, col: number) {
        const [x, z] = cellToWorld(placements.ai, { row, col }, size)
        const v = new Vector3(x, 0, z).project(camera)
        return {
          x: canvasSize.left + ((v.x + 1) / 2) * canvasSize.width,
          y: canvasSize.top + ((1 - v.y) / 2) * canvasSize.height,
        }
      },
    }
    return () => void delete w.__battle3d
  }, [camera, canvasSize, placements, size])

  return (
    <>
      <CameraRig
        layout={layout}
        focus={focus}
        placements={placements}
        size={size}
        reduced={reduced}
        insets={insets}
        shake={shake}
      />
      <Ocean
        placements={placements}
        size={size}
        waveAmp={waveAmp}
        humanTurn={humanTurn}
        fire={fire}
        state={state}
      />
      <Sky />
      <hemisphereLight args={['#bcd7f0', '#0b1a2a', 1.4]} />
      <directionalLight position={[9, 15, -10]} intensity={2.2} />
      <BoardLabels board={placements.ai} size={size} title="ENEMY WATERS" />
      <BoardLabels board={placements.human} size={size} title="YOUR FLEET" />
      {(['human', 'ai'] as const).flatMap((owner) =>
        shipsFor(owner).map(({ ship, sunk }) => (
          <ShipModel
            key={`${owner}-${ship.type}`}
            ship={ship}
            board={placements[owner]}
            size={size}
            sunk={sunk}
            team={teams[owner]}
            waveAmp={waveAmp}
          />
        )),
      )}
      <Pegs shots={shots} shotsKey={shotsKey} />
      <FireField emitters={emitters} reduced={reduced} />
      {pending && (
        <PendingShot
          key={pending.id}
          event={pending}
          reduced={reduced}
          from={launchPoint(pending)}
          placements={placements}
          size={size}
          onLand={land}
        />
      )}
      {bursts.map((b) => (
        <Burst
          key={b.id}
          at={b.at}
          kind={b.kind}
          delay={b.delay}
          reduced={reduced}
          onDone={() => setBursts((all) => all.filter((x) => x.id !== b.id))}
        />
      ))}
      {fpsEl && <FpsMeter el={fpsEl} />}
    </>
  )
}

function PendingShot({
  event,
  from,
  reduced,
  placements,
  size,
  onLand,
}: {
  event: ShotEvent
  from: Vec3
  reduced: boolean
  placements: Record<PlayerId, BoardPlacement>
  size: number
  onLand: (e: ShotEvent) => void
}) {
  const defender: PlayerId = event.by === 'human' ? 'ai' : 'human'
  const [x, z] = cellToWorld(placements[defender], event.coord, size)
  const landRef = useRef(onLand)
  useLayoutEffect(() => {
    landRef.current = onLand
  })
  useEffect(() => {
    if (reduced) landRef.current(event)
  }, [reduced, event])
  if (reduced) return null
  return (
    <Shell
      from={from}
      to={[x, 0.2, z]}
      duration={SHELL_SECONDS}
      onLand={() => landRef.current(event)}
    />
  )
}

function CameraRig({
  layout,
  focus,
  placements,
  size,
  reduced,
  insets,
  shake,
}: {
  layout: BattleLayout
  focus: PlayerId
  placements: Record<PlayerId, BoardPlacement>
  size: number
  reduced: boolean
  insets: RefObject<HudInsets>
  shake: RefObject<number>
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const first = useRef(true)
  const goal = useMemo(
    () => ({ pos: new Vector3(), look: new Vector3(), curLook: new Vector3() }),
    [],
  )

  useFrame(({ size: canvas, clock }, dt) => {
    const framing = framingFor(layout, focus, placements, size)
    const { top, bottom } = insets.current
    const free = Math.max(canvas.height - top - bottom, 1) / canvas.height
    const dist = framingDistance(framing, canvas.width / canvas.height, CAMERA_FOV, free)
    goal.pos.set(...cameraPosition(framing, dist))
    goal.look.set(framing.centerX, 0, framing.centerZ)
    if (!reduced) {
      const t = clock.elapsedTime
      goal.pos.x += Math.sin(t * 0.21) * 0.35
      goal.pos.y += Math.sin(t * 0.17) * 0.25
    }
    const k = first.current || reduced ? 1 : 1 - Math.exp(-dt * 2.5)
    first.current = false
    camera.position.lerp(goal.pos, k)
    goal.curLook.lerp(goal.look, k)
    if (shake.current > 0.001) {
      const s = shake.current
      camera.position.x += (Math.random() - 0.5) * s
      camera.position.y += (Math.random() - 0.5) * s
      shake.current = s * Math.exp(-dt * 9)
    }
    camera.lookAt(goal.curLook)
    // Centre the boards in the area left free by the HUD instead of the full canvas.
    camera.setViewOffset(
      canvas.width,
      canvas.height,
      0,
      -(top - bottom) / 2,
      canvas.width,
      canvas.height,
    )
    camera.updateProjectionMatrix()
  })
  return null
}

function Ocean({
  placements,
  size,
  waveAmp,
  humanTurn,
  fire,
  state,
}: {
  placements: Record<PlayerId, BoardPlacement>
  size: number
  waveAmp: number
  humanTurn: boolean
  fire: (coord: Coord) => void
  state: GameState
}) {
  const material = useMemo(createWaterMaterial, [])
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(110, 110, 140, 140)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const pick = useMemo(() => {
    const g = new PlaneGeometry(size, size)
    g.rotateX(-Math.PI / 2)
    return g
  }, [size])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uAmp.value = waveAmp
    u.uHalf.value = size / 2
    u.uEnemy.value.set(placements.ai.x, placements.ai.z)
    u.uMine.value.set(placements.human.x, placements.human.z)
    u.uActive.value = humanTurn ? 1 : 0
    if (!humanTurn) u.uHover.value.set(-1, -1)
  })

  const cellAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    worldToCell(placements.ai, e.point.x, e.point.z, size)
  const hover = (coord: Coord | null) => {
    const ok = coord && canFire(state, 'human', coord)
    material.uniforms.uHover.value.set(ok ? coord.col : -1, ok ? coord.row : -1)
    document.body.style.cursor = ok ? 'crosshair' : ''
  }
  useEffect(() => () => void (document.body.style.cursor = ''), [])

  return (
    <>
      <mesh geometry={geometry} material={material} />
      <mesh
        geometry={pick}
        position={[placements.ai.x, 0.05, placements.ai.z]}
        onPointerMove={(e) => hover(cellAt(e))}
        onPointerDown={(e) => hover(cellAt(e))}
        onPointerOut={() => hover(null)}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 12) return
          const coord = cellAt(e)
          if (coord && humanTurn && canFire(state, 'human', coord)) fire(coord)
          if ((e.nativeEvent as PointerEvent).pointerType !== 'mouse') hover(null)
        }}
      >
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  )
}

function Sky() {
  const material = useMemo(createSkyMaterial, [])
  const geometry = useMemo(() => new SphereGeometry(160, 24, 12), [])
  return <mesh geometry={geometry} material={material} />
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Coordinate letters/numbers and a title around a board, drawn once into a texture. */
function BoardLabels({
  board,
  size,
  title,
}: {
  board: BoardPlacement
  size: number
  title: string
}) {
  const span = size + 3
  const texture = useMemo(() => {
    const px = 1024
    const unit = px / span
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = px
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.85)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold ${unit * 0.5}px system-ui, sans-serif`
      const origin = 1.5 * unit
      for (let i = 0; i < size; i++) {
        ctx.fillText(COLUMNS[i], origin + (i + 0.5) * unit, origin - unit * 0.45)
        ctx.fillText(String(i + 1), origin - unit * 0.5, origin + (i + 0.5) * unit)
      }
      ctx.font = `800 ${unit * 0.55}px system-ui, sans-serif`
      ctx.fillStyle = 'rgba(224, 242, 254, 0.9)'
      ctx.fillText(title, px / 2, origin + size * unit + unit * 0.65)
    }
    const t = new CanvasTexture(canvas)
    t.anisotropy = 4
    return t
  }, [size, span, title])
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(span, span)
    g.rotateX(-Math.PI / 2)
    return g
  }, [span])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh geometry={geometry} position={[board.x, 0.22, board.z]} renderOrder={1}>
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

const pegGeometry = new CylinderGeometry(0.08, 0.11, 0.5, 8)
const MISS_PEG = new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5, flatShading: true })
const HIT_PEG = new MeshStandardMaterial({
  color: '#ef4444',
  emissive: '#7f1d1d',
  roughness: 0.5,
  flatShading: true,
})
const MAX_PEGS = 200

function Pegs({
  shots,
  shotsKey,
}: {
  shots: { x: number; z: number; result: string }[]
  shotsKey: string
}) {
  const misses = useRef<InstancedMesh>(null)
  const hits = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const dummy = new Object3D()
    const fill = (mesh: InstancedMesh | null, wanted: string) => {
      if (!mesh) return
      let n = 0
      for (const s of shots) {
        if (s.result !== wanted) continue
        dummy.position.set(s.x, wanted === 'hit' ? 0.42 : 0.16, s.z)
        dummy.updateMatrix()
        mesh.setMatrixAt(n++, dummy.matrix)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    fill(misses.current, 'miss')
    fill(hits.current, 'hit')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotsKey])
  return (
    <>
      <instancedMesh ref={misses} args={[pegGeometry, MISS_PEG, MAX_PEGS]} frustumCulled={false} />
      <instancedMesh ref={hits} args={[pegGeometry, HIT_PEG, MAX_PEGS]} frustumCulled={false} />
    </>
  )
}

function FpsMeter({ el }: { el: RefObject<HTMLElement | null> }) {
  const acc = useRef({ frames: 0, since: performance.now() })
  useFrame(() => {
    const a = acc.current
    a.frames++
    const now = performance.now()
    if (now - a.since >= 1000) {
      const fps = (a.frames * 1000) / (now - a.since)
      if (el.current) {
        el.current.textContent = `${fps.toFixed(0)} fps`
        el.current.dataset.fps = fps.toFixed(1)
      }
      a.frames = 0
      a.since = now
    }
  })
  return null
}
