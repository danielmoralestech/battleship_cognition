export type ParticleKind = 'spark' | 'drop' | 'smoke' | 'ring' | 'flash' | 'shell'

export interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  /** Seconds alive so far / total lifetime. */
  age: number
  life: number
  size: number
  /** Size change in px per second. */
  grow: number
  /** "r,g,b" */
  color: string
  gravity: number
  drag: number
  /** Shell flight path: start, end and arc height. */
  path?: { x0: number; y0: number; x1: number; y1: number; arc: number }
}

type Rand = () => number

const TAU = Math.PI * 2
const FIRE = ['253,224,71', '251,146,60', '248,113,113']
const FIREWORK = ['253,224,71', '125,211,252', '244,114,182', '134,239,172', '251,146,60']

function particle(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y' | 'life'>): Particle {
  return { vx: 0, vy: 0, age: 0, size: 2, grow: 0, color: '255,255,255', gravity: 0, drag: 0, ...p }
}

const between = (rand: Rand, a: number, b: number) => a + rand() * (b - a)
const pick = <T>(rand: Rand, xs: T[]) => xs[Math.floor(rand() * xs.length)]

function burst(
  rand: Rand,
  n: number,
  base: Omit<Particle, 'vx' | 'vy' | 'age' | 'life' | 'size' | 'color'> & {
    speed: [number, number]
    life: [number, number]
    size: [number, number]
    colors: string[]
    angle?: [number, number]
  },
): Particle[] {
  const { speed, life, size, colors, angle = [0, TAU], ...rest } = base
  return Array.from({ length: n }, () => {
    const a = between(rand, angle[0], angle[1])
    const v = between(rand, speed[0], speed[1])
    return particle({
      ...rest,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: between(rand, life[0], life[1]),
      size: between(rand, size[0], size[1]),
      color: pick(rand, colors),
    })
  })
}

export function shellPosition(p: Particle, t: number): { x: number; y: number } {
  const { x0, y0, x1, y1, arc } = p.path!
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t - arc * 4 * t * (1 - t) }
}

/** A shell flying from (x0, y0) to (x1, y1) over `life` seconds. */
export function shell(x0: number, y0: number, x1: number, y1: number, s: number, life = 0.28) {
  return particle({
    kind: 'shell',
    x: x0,
    y: y0,
    life,
    size: 2.5 * s,
    color: '255,237,213',
    path: { x0, y0, x1, y1, arc: 50 * s },
  })
}

export function splash(x: number, y: number, s: number, rand: Rand = Math.random): Particle[] {
  return [
    particle({ kind: 'ring', x, y, life: 0.7, size: 2 * s, grow: 45 * s, color: '186,230,253' }),
    particle({ kind: 'ring', x, y, life: 0.9, size: 1 * s, grow: 28 * s, color: '125,211,252' }),
    ...burst(rand, 18, {
      kind: 'drop',
      x,
      y,
      grow: 0,
      gravity: 420 * s,
      drag: 1,
      angle: [-Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8],
      speed: [50 * s, 150 * s],
      life: [0.45, 0.8],
      size: [1.2 * s, 2.4 * s],
      colors: ['224,242,254', '186,230,253'],
    }),
  ]
}

export function explosion(
  x: number,
  y: number,
  s: number,
  big = false,
  rand: Rand = Math.random,
): Particle[] {
  const k = big ? 1.5 : 1
  return [
    ...burst(rand, big ? 12 : 6, {
      kind: 'smoke',
      x,
      y,
      grow: 14 * s,
      gravity: -30 * s,
      drag: 1.5,
      angle: [-Math.PI, 0],
      speed: [8 * s, 35 * s * k],
      life: [0.9, 1.6],
      size: [4 * s, 7 * s],
      colors: ['71,85,105', '51,65,85'],
    }),
    particle({
      kind: 'flash',
      x,
      y,
      life: 0.3 * k,
      size: 16 * s * k,
      grow: 40 * s,
      color: FIRE[1],
    }),
    ...burst(rand, big ? 40 : 22, {
      kind: 'spark',
      x,
      y,
      grow: 0,
      gravity: 140 * s,
      drag: 3,
      speed: [70 * s, 220 * s * k],
      life: [0.35, 0.75],
      size: [1.1 * s, 2.3 * s],
      colors: FIRE,
    }),
  ]
}

export function firework(x: number, y: number, s: number, rand: Rand = Math.random): Particle[] {
  const color = pick(rand, FIREWORK)
  return [
    particle({ kind: 'flash', x, y, life: 0.25, size: 20 * s, grow: 30 * s, color }),
    ...burst(rand, 46, {
      kind: 'spark',
      x,
      y,
      grow: 0,
      gravity: 70 * s,
      drag: 1.4,
      speed: [40 * s, 170 * s],
      life: [0.9, 1.5],
      size: [1.2 * s, 2.2 * s],
      colors: [color, color, '255,255,255'],
    }),
  ]
}

/** A glowing ember drifting up from the bottom edge of a w×h area. */
export function ember(w: number, h: number, rand: Rand = Math.random): Particle {
  return particle({
    kind: 'spark',
    x: between(rand, 0, w),
    y: h + 4,
    vx: between(rand, -12, 12),
    vy: between(rand, -70, -25),
    gravity: -8,
    drag: 0.2,
    life: between(rand, 2.5, 4.5),
    size: between(rand, 1, 2.4),
    color: pick(rand, ['251,146,60', '248,113,113', '253,186,116']),
  })
}

/** Advances particles by `dt` seconds and returns the ones still alive. */
export function step(ps: Particle[], dt: number): Particle[] {
  const alive: Particle[] = []
  for (const p of ps) {
    p.age += dt
    if (p.age >= p.life) continue
    if (p.path) {
      Object.assign(p, shellPosition(p, p.age / p.life))
    } else {
      const k = Math.exp(-p.drag * dt)
      p.vx *= k
      p.vy = p.vy * k + p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.size = Math.max(0, p.size + p.grow * dt)
    }
    alive.push(p)
  }
  return alive
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, TAU)
  ctx.fill()
}

export function draw(ctx: CanvasRenderingContext2D, ps: Particle[]) {
  for (const p of ps) {
    const fade = 1 - p.age / p.life
    ctx.globalCompositeOperation =
      p.kind === 'spark' || p.kind === 'flash' || p.kind === 'shell' ? 'lighter' : 'source-over'
    switch (p.kind) {
      case 'ring':
        ctx.strokeStyle = `rgba(${p.color},${fade * 0.8})`
        ctx.lineWidth = 0.5 + 2 * fade
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, TAU)
        ctx.stroke()
        break
      case 'flash': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, p.size))
        g.addColorStop(0, `rgba(255,251,235,${fade})`)
        g.addColorStop(0.35, `rgba(${p.color},${fade * 0.75})`)
        g.addColorStop(1, `rgba(${p.color},0)`)
        ctx.fillStyle = g
        circle(ctx, p.x, p.y, p.size)
        break
      }
      case 'smoke':
        ctx.fillStyle = `rgba(${p.color},${fade * 0.4})`
        circle(ctx, p.x, p.y, p.size)
        break
      case 'shell': {
        const t = p.age / p.life
        for (let i = 5; i >= 1; i--) {
          const q = shellPosition(p, Math.max(0, t - i * 0.03))
          ctx.fillStyle = `rgba(251,146,60,${0.12 * (6 - i)})`
          circle(ctx, q.x, q.y, p.size * (1 - i * 0.12))
        }
        ctx.fillStyle = `rgba(${p.color},1)`
        circle(ctx, p.x, p.y, p.size)
        break
      }
      default:
        ctx.fillStyle = `rgba(${p.color},${fade})`
        circle(ctx, p.x, p.y, p.size * (0.4 + 0.6 * fade))
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

/** Runs particles on a canvas, animating only while there is something to draw. */
export class ParticleEngine {
  private particles: Particle[] = []
  private frame = 0
  private last = 0
  private timers: ReturnType<typeof setTimeout>[] = []
  private ctx: CanvasRenderingContext2D | null
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
  }

  get width() {
    return this.canvas.clientWidth
  }

  get height() {
    return this.canvas.clientHeight
  }

  emit(ps: Particle | Particle[]) {
    if (!this.ctx) return
    this.particles.push(...(Array.isArray(ps) ? ps : [ps]))
    if (!this.frame) {
      this.resize()
      this.last = performance.now()
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  after(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms))
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.timers.forEach(clearTimeout)
    this.particles = []
    this.frame = 0
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.round(this.width * dpr)
    const h = Math.round(this.height * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private tick = (now: number) => {
    const ctx = this.ctx!
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.particles = step(this.particles, dt)
    ctx.clearRect(0, 0, this.width, this.height)
    draw(ctx, this.particles)
    this.frame = this.particles.length ? requestAnimationFrame(this.tick) : 0
  }
}
