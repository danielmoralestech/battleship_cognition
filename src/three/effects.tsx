import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  type Blending,
} from 'three'

export type Vec3 = [number, number, number]

/** Converts a world-space point size to pixels for the current camera and drawing buffer. */
function usePixelScale(material: ShaderMaterial) {
  useFrame(({ camera, size, viewport }) => {
    material.uniforms.uPixel.value =
      (size.height * viewport.dpr * camera.projectionMatrix.elements[5]) / 2
  })
}

const seeded = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const SPRITE_FRAG = (body: string) => /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vAge;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    ${body}
  }
`

interface LoopingKind {
  life: number
  rise: number
  wind: number
  size: [number, number]
  colors: [string, string]
  blending: Blending
  frag: string
}

const FIRE: LoopingKind = {
  life: 0.9,
  rise: 0.7,
  wind: 0.1,
  size: [0.42, 0.08],
  colors: ['#fde68a', '#ea580c'],
  blending: AdditiveBlending,
  frag: SPRITE_FRAG(
    'gl_FragColor = vec4(mix(uColorA, uColorB, vAge) * soft * (1.0 - vAge) * uOpacity, 1.0);',
  ),
}

const SMOKE: LoopingKind = {
  life: 2.6,
  rise: 1.9,
  wind: 0.9,
  size: [0.25, 1.1],
  colors: ['#44403c', '#1c1917'],
  blending: NormalBlending,
  frag: SPRITE_FRAG(
    'gl_FragColor = vec4(mix(uColorA, uColorB, vAge), soft * sin(vAge * 3.14159) * 0.5 * uOpacity);',
  ),
}

function loopingMaterial(kind: LoopingKind) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: kind.blending,
    uniforms: {
      uTime: { value: 0 },
      uPixel: { value: 1 },
      uLife: { value: kind.life },
      uRise: { value: kind.rise },
      uWind: { value: kind.wind },
      uSize0: { value: kind.size[0] },
      uSize1: { value: kind.size[1] },
      uColorA: { value: colorVec(kind.colors[0]) },
      uColorB: { value: colorVec(kind.colors[1]) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixel;
      uniform float uLife;
      uniform float uRise;
      uniform float uWind;
      uniform float uSize0;
      uniform float uSize1;
      varying float vAge;
      void main() {
        float age = fract(uTime / uLife + aSeed);
        float a = aSeed * 43.0;
        vec3 p = position;
        p.x += sin(a) * 0.14 + age * age * uWind;
        p.z += cos(a) * 0.14 - age * age * uWind * 0.4;
        p.y += age * uRise;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = mix(uSize0, uSize1, age) * uPixel / -mv.z;
        gl_Position = projectionMatrix * mv;
        vAge = age;
      }
    `,
    fragmentShader: kind.frag,
  })
}

function colorVec(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Continuous fire and smoke above every hit. One draw call per particle kind; particles are
 * animated entirely in the vertex shader, so there is no per-frame CPU work besides one uniform.
 */
export function FireField({ emitters, reduced }: { emitters: Vec3[]; reduced: boolean }) {
  const perFire = reduced ? 3 : 9
  const perSmoke = reduced ? 2 : 7
  return (
    <>
      <LoopingPoints emitters={emitters} perEmitter={perSmoke} kind={SMOKE} />
      <LoopingPoints emitters={emitters} perEmitter={perFire} kind={FIRE} />
    </>
  )
}

function LoopingPoints({
  emitters,
  perEmitter,
  kind,
}: {
  emitters: Vec3[]
  perEmitter: number
  kind: LoopingKind
}) {
  const material = useMemo(() => loopingMaterial(kind), [kind])
  const geometry = useMemo(() => {
    const n = emitters.length * perEmitter
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    emitters.forEach((e, i) => {
      for (let j = 0; j < perEmitter; j++) {
        const k = i * perEmitter + j
        pos.set(e, k * 3)
        seed[k] = j / perEmitter + seeded(k) * 0.15
      }
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(seed, 1))
    return g
  }, [emitters, perEmitter])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  usePixelScale(material)
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })
  if (emitters.length === 0) return null
  return <points geometry={geometry} material={material} frustumCulled={false} />
}

export type BurstKind = 'splash' | 'explosion'

const BURST = {
  splash: { life: 1.1, gravity: 9, colors: ['#e0f2fe', '#7dd3fc'], size: 0.22, additive: false },
  explosion: { life: 0.9, gravity: 4, colors: ['#fef08a', '#dc2626'], size: 0.4, additive: true },
} as const

function burstMaterial(kind: BurstKind) {
  const cfg = BURST[kind]
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: cfg.additive ? AdditiveBlending : NormalBlending,
    uniforms: {
      uT: { value: 0 },
      uPixel: { value: 1 },
      uLife: { value: cfg.life },
      uGravity: { value: cfg.gravity },
      uSize: { value: cfg.size },
      uColorA: { value: colorVec(cfg.colors[0]) },
      uColorB: { value: colorVec(cfg.colors[1]) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aVel;
      uniform float uT;
      uniform float uPixel;
      uniform float uLife;
      uniform float uGravity;
      uniform float uSize;
      varying float vAge;
      void main() {
        vec3 p = position + aVel * uT;
        p.y = max(p.y - 0.5 * uGravity * uT * uT, -0.05);
        vAge = clamp(uT / uLife, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (1.0 - vAge * 0.6) * uPixel / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: SPRITE_FRAG(
      cfg.additive
        ? 'gl_FragColor = vec4(mix(uColorA, uColorB, vAge) * soft * (1.0 - vAge), 1.0);'
        : 'gl_FragColor = vec4(mix(uColorA, uColorB, vAge), soft * (1.0 - vAge) * 0.9);',
    ),
  })
}

const ringGeometry = new RingGeometry(0.7, 1, 24)
ringGeometry.rotateX(-Math.PI / 2)
const flashGeometry = new SphereGeometry(0.5, 10, 8)

/** One-shot splash (miss) or explosion (hit): particles + expanding ripple (+ flash on hits). */
export function Burst({
  at,
  kind,
  reduced,
  onDone,
}: {
  at: Vec3
  kind: BurstKind
  reduced: boolean
  onDone: () => void
}) {
  const cfg = BURST[kind]
  const count = reduced ? 8 : kind === 'explosion' ? 56 : 40
  const material = useMemo(() => burstMaterial(kind), [kind])
  const ringMat = useMemo(
    () => new MeshBasicMaterial({ color: '#e0f2fe', transparent: true, depthWrite: false }),
    [],
  )
  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#fdba74',
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const speed = reduced ? 0.5 : 1
    for (let i = 0; i < count; i++) {
      const a = seeded(i + count) * Math.PI * 2
      const r = seeded(i * 3 + 1)
      pos.set(at, i * 3)
      if (kind === 'splash') {
        vel.set(
          [Math.cos(a) * r * 1.1 * speed, (3 + r * 2.5) * speed, Math.sin(a) * r * 1.1 * speed],
          i * 3,
        )
      } else {
        const up = seeded(i * 7 + 2)
        vel.set(
          [
            Math.cos(a) * (1 + r * 2.4) * speed,
            (1 + up * 3) * speed,
            Math.sin(a) * (1 + r * 2.4) * speed,
          ],
          i * 3,
        )
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aVel', new BufferAttribute(vel, 3))
    return g
  }, [at, count, kind, reduced])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      ringMat.dispose()
      flashMat.dispose()
    },
    [geometry, material, ringMat, flashMat],
  )
  usePixelScale(material)

  const start = useRef<number | null>(null)
  const done = useRef(false)
  const ring = useRef<Mesh>(null)
  const flash = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime
    const t = clock.elapsedTime - start.current
    material.uniforms.uT.value = t
    const u = Math.min(t / (cfg.life * 1.4), 1)
    if (ring.current) {
      ring.current.scale.setScalar(0.25 + u * (reduced ? 0.6 : 1.1))
      ringMat.opacity = (1 - u) * 0.7
    }
    if (flash.current) {
      const f = Math.min(t / 0.25, 1)
      flash.current.scale.setScalar(0.3 + f * 0.9)
      flashMat.opacity = 1 - f
    }
    if (t > cfg.life * 1.4 && !done.current) {
      done.current = true
      onDone()
    }
  })

  return (
    <>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <mesh ref={ring} geometry={ringGeometry} material={ringMat} position={[at[0], 0.08, at[2]]} />
      {kind === 'explosion' && !reduced && (
        <mesh ref={flash} geometry={flashGeometry} material={flashMat} position={at} />
      )}
    </>
  )
}

const shellGeometry = new SphereGeometry(0.11, 10, 8)
const shellMaterial = new MeshBasicMaterial({ color: '#fde68a' })
const trailMaterial = new MeshBasicMaterial({
  color: '#fb923c',
  transparent: true,
  opacity: 0.5,
  blending: AdditiveBlending,
  depthWrite: false,
})
const TRAIL = 6

/** A shell on a ballistic-looking arc; calls `onLand` once when it reaches the target. */
export function Shell({
  from,
  to,
  duration,
  onLand,
}: {
  from: Vec3
  to: Vec3
  duration: number
  onLand: () => void
}) {
  const group = useRef<Group>(null)
  const start = useRef<number | null>(null)
  const landed = useRef(false)
  const dist = Math.hypot(to[0] - from[0], to[2] - from[2])
  const arc = 1.5 + dist * 0.3

  const at = (u: number): Vec3 => {
    const c = Math.max(0, Math.min(1, u))
    return [
      from[0] + (to[0] - from[0]) * c,
      from[1] + (to[1] - from[1]) * c + arc * 4 * c * (1 - c),
      from[2] + (to[2] - from[2]) * c,
    ]
  }

  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime
    const u = (clock.elapsedTime - start.current) / duration
    const g = group.current
    if (g) {
      g.children.forEach((child, i) => {
        child.position.set(...at(u - i * 0.025))
      })
    }
    if (u >= 1 && !landed.current) {
      landed.current = true
      onLand()
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={shellGeometry} material={shellMaterial} position={from} />
      {Array.from({ length: TRAIL }, (_, i) => (
        <mesh
          key={i}
          geometry={shellGeometry}
          material={trailMaterial}
          position={from}
          scale={1 - (i + 1) / (TRAIL + 1)}
        />
      ))}
    </group>
  )
}
