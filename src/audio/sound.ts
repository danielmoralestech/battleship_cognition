import type { RuleSet, ShotEvent } from '../engine/types'
import * as naval from './naval'

export type Cue = 'fire' | 'whistle' | 'splash' | 'hit' | 'sink' | 'victory' | 'defeat'

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
    /** Dev builds only: every cue played, so e2e tests can check sounds without hearing them. */
    __sounds?: Cue[]
  }
}

const MASTER_GAIN = 0.8
/** A context resumed by a gesture may still report "suspended" for a moment; schedule anyway. */
const RESUME_GRACE_MS = 1000

let ctx: AudioContext | null = null
let bus: naval.Bus | null = null
let enabled = true
let primed = false
let resumedAt = -Infinity

function create(): AudioContext | null {
  const Ctor = window.AudioContext ?? window.webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  bus = naval.createBus(ctx, ctx.destination)
  bus.master.gain.value = enabled ? MASTER_GAIN : 0
  return ctx
}

/** Browsers, iPhone Safari especially, only let audio start inside a user gesture. */
function unlock() {
  if (!enabled) return
  const c = ctx ?? create()
  if (!c) return
  if (c.state !== 'running') {
    resumedAt = performance.now()
    void c.resume().catch(() => {})
  }
  if (!primed) {
    // Older iOS also needs a sound started within the gesture before later sounds can play.
    const blank = c.createBufferSource()
    blank.buffer = c.createBuffer(1, 1, 22050)
    blank.connect(c.destination)
    blank.start(0)
    primed = true
  }
}

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const

/** Unlocks audio on the first gesture (and re-resumes after iOS suspends it). Returns a cleanup. */
export function installSoundUnlock(): () => void {
  // iOS 17+: mix with the user's music and follow the silent switch, like other casual games.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'ambient'
  for (const e of GESTURES) window.addEventListener(e, unlock, { capture: true, passive: true })
  return () => {
    for (const e of GESTURES) window.removeEventListener(e, unlock, { capture: true })
  }
}

export function setSoundEnabled(on: boolean) {
  enabled = on
  if (ctx && bus) bus.master.gain.setTargetAtTime(on ? MASTER_GAIN : 0, ctx.currentTime, 0.02)
}

function output(): { c: AudioContext; out: AudioNode } | null {
  if (!enabled || !ctx || !bus) return null
  const ready =
    ctx.state === 'running' ||
    (ctx.state === 'suspended' && performance.now() - resumedAt < RESUME_GRACE_MS)
  return ready ? { c: ctx, out: bus.input } : null
}

function record(...cues: Cue[]) {
  if (import.meta.env.DEV) (window.__sounds ??= []).push(...cues)
}

/** Gun fire now, a whistle while the shell flies, and the impact when it lands after `flightMs`. */
export function playShot(event: ShotEvent, rules: RuleSet, flightMs: number) {
  const audio = output()
  if (!audio) return
  const { c, out } = audio
  const t = c.currentTime + 0.01
  const land = t + flightMs / 1000
  naval.fire(c, out, t)
  record('fire')
  if (flightMs > 0) {
    naval.whistle(c, out, t + 0.05, flightMs / 1000)
    record('whistle')
  }
  if (event.result === 'miss') {
    naval.splash(c, out, land)
    record('splash')
  } else if (event.result === 'hit') {
    naval.hit(c, out, land)
    record('hit')
  } else {
    const length = rules.fleet.find((s) => s.type === event.sunkShip)?.length ?? 3
    naval.sink(c, out, land, length)
    record('sink')
  }
}

export function playGameOver(won: boolean, delayMs: number) {
  const audio = output()
  if (!audio) return
  const { c, out } = audio
  const t = c.currentTime + delayMs / 1000
  if (won) naval.victory(c, out, t)
  else naval.defeat(c, out, t)
  record(won ? 'victory' : 'defeat')
}
