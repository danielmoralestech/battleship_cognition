import { SINK_CHAIN_MS } from '../effects/timing'

// Naval sound set, synthesised with Web Audio so there are no files to download.
// Every voice takes a start time `t` (in the context's clock) and an output node.

type Ctx = BaseAudioContext
type Out = AudioNode

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>()

function noise(ctx: Ctx): AudioBufferSourceNode {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, buffer)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  return src
}

/** A gain envelope: quick rise to `peak`, exponential fall until `t + end`. */
function envelope(ctx: Ctx, out: Out, t: number, peak: number, attack: number, end: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + end)
  g.connect(out)
  return g
}

function filter(
  ctx: Ctx,
  type: BiquadFilterType,
  f0: number,
  t: number,
  f1?: number,
  dur = 0,
  q = 0.7,
) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur)
  return f
}

function tone(ctx: Ctx, type: OscillatorType, f0: number, t: number, f1?: number, dur = 0) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  return o
}

function play(src: AudioScheduledSourceNode, dest: AudioNode, t: number, dur: number) {
  src.connect(dest)
  src.start(t)
  src.stop(t + dur + 0.05)
}

/** Filtered white noise through `filters` (in order) into an envelope. */
function noiseBurst(
  ctx: Ctx,
  out: Out,
  t: number,
  dur: number,
  filters: BiquadFilterNode[],
  peak: number,
  attack: number,
) {
  let node: AudioNode = envelope(ctx, out, t, peak, attack, dur)
  for (const f of [...filters].reverse()) {
    f.connect(node)
    node = f
  }
  play(noise(ctx), node, t, dur)
}

export interface Bus {
  master: GainNode
  /** Voices connect here; it feeds the master both directly and through a short reverb. */
  input: GainNode
}

/** Master chain: voices -> dry + reverb -> master gain -> compressor -> destination. */
export function createBus(ctx: Ctx, dest: AudioNode): Bus {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -10
  comp.ratio.value = 4
  comp.connect(dest)
  const master = ctx.createGain()
  master.connect(comp)
  const input = ctx.createGain()
  input.connect(master)

  const len = Math.floor(ctx.sampleRate * 1.6)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  const reverb = ctx.createConvolver()
  reverb.buffer = ir
  const wet = ctx.createGain()
  wet.gain.value = 0.3
  input.connect(reverb)
  reverb.connect(wet)
  wet.connect(master)
  return { master, input }
}

export function fire(ctx: Ctx, out: Out, t: number) {
  const lp = filter(ctx, 'lowpass', 700, t, 220, 0.6)
  lp.connect(out)
  play(tone(ctx, 'sine', 85, t, 30, 0.6), envelope(ctx, lp, t, 0.9, 0.015, 0.9), t, 0.9)
  noiseBurst(ctx, lp, t, 0.9, [filter(ctx, 'lowpass', 900, t, 120, 0.7)], 0.9, 0.012)
}

/** Falling shell whistle lasting `dur` seconds, ending as the shell lands. */
export function whistle(ctx: Ctx, out: Out, t: number, dur: number) {
  const g = ctx.createGain()
  g.connect(out)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  play(tone(ctx, 'sine', 1700, t, 650, dur), g, t, dur)
}

export function splash(ctx: Ctx, out: Out, t: number) {
  play(tone(ctx, 'sine', 170, t, 55, 0.18), envelope(ctx, out, t, 0.45, 0.005, 0.22), t, 0.22)
  noiseBurst(ctx, out, t, 0.95, [filter(ctx, 'bandpass', 1700, t, 420, 0.8, 0.9)], 0.7, 0.02)
  noiseBurst(ctx, out, t + 0.05, 0.6, [filter(ctx, 'highpass', 3500, t)], 0.08, 0.05)
  for (let i = 0; i < 7; i++) {
    const at = t + 0.12 + Math.random() * 0.55
    const f0 = 900 + Math.random() * 1400
    const drop = tone(ctx, 'sine', f0, at, 2400 + Math.random() * 600, 0.04)
    play(drop, envelope(ctx, out, at, 0.05, 0.003, 0.05), at, 0.05)
  }
}

export function hit(ctx: Ctx, out: Out, t: number, scale = 1) {
  noiseBurst(ctx, out, t, 1.3, [filter(ctx, 'lowpass', 1600, t, 140, 1.1)], 0.55 * scale, 0.01)
  play(tone(ctx, 'sine', 85, t, 26, 0.9), envelope(ctx, out, t, 0.45 * scale, 0.008, 1), t, 1)
  noiseBurst(
    ctx,
    out,
    t + 0.02,
    0.7,
    [filter(ctx, 'bandpass', 900, t, 300, 0.6, 1.2)],
    0.22 * scale,
    0.01,
  )
  noiseBurst(ctx, out, t, 1.1, [filter(ctx, 'lowpass', 320, t, 90, 1)], 0.5 * scale, 0.01)
  play(tone(ctx, 'sine', 70, t, 34, 1.1), envelope(ctx, out, t, 0.4 * scale, 0.01, 1.2), t, 1.2)
}

/** Chained blasts along the hull (matching the visual chain), then a rumble, groan and bubbles. */
export function sink(ctx: Ctx, out: Out, t: number, length: number) {
  for (let i = 0; i < length; i++) {
    hit(ctx, out, t + (i * SINK_CHAIN_MS) / 1000, Math.max(0.2, 0.6 - i * 0.08))
  }
  const rumble = ctx.createGain()
  rumble.connect(out)
  rumble.gain.setValueAtTime(0.0001, t)
  rumble.gain.exponentialRampToValueAtTime(0.45, t + 0.4)
  rumble.gain.setValueAtTime(0.45, t + 1.6)
  rumble.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
  play(noise(ctx), filterInto(ctx, rumble, 'lowpass', 140, t), t, 3.2)

  const groan = tone(ctx, 'triangle', 75, t + 0.6, 38, 2.4)
  const lfo = tone(ctx, 'sine', 3.5, t)
  const depth = ctx.createGain()
  depth.gain.value = 6
  lfo.connect(depth)
  depth.connect(groan.frequency)
  lfo.start(t)
  lfo.stop(t + 3.2)
  const groanGain = ctx.createGain()
  groanGain.connect(out)
  groanGain.gain.setValueAtTime(0.0001, t + 0.6)
  groanGain.gain.exponentialRampToValueAtTime(0.05, t + 1.2)
  groanGain.gain.exponentialRampToValueAtTime(0.0001, t + 3)
  const groanFilter = filter(ctx, 'lowpass', 300, t, undefined, 0, 2.5)
  groanFilter.connect(groanGain)
  play(groan, groanFilter, t + 0.6, 2.4)

  for (let i = 0; i < 14; i++) {
    const at = t + 1.3 + Math.random() * 1.6
    const f0 = 150 + Math.random() * 200
    const bubble = tone(ctx, 'sine', f0, at, f0 * 1.5, 0.08)
    play(bubble, envelope(ctx, out, at, 0.035, 0.01, 0.09), at, 0.09)
  }
}

function filterInto(ctx: Ctx, out: AudioNode, type: BiquadFilterType, f: number, t: number) {
  const node = filter(ctx, type, f, t)
  node.connect(out)
  return node
}

export function victory(ctx: Ctx, out: Out, t: number) {
  const brass = (freq: number, at: number, dur: number, vol = 0.12) => {
    const g = ctx.createGain()
    g.connect(out)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.03)
    g.gain.linearRampToValueAtTime(vol * 0.8, at + dur - 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.25)
    const f = filter(ctx, 'lowpass', 900, at, 2600, 0.08)
    f.connect(g)
    for (const detune of [-6, 6]) {
      const o = tone(ctx, 'sawtooth', freq, at)
      o.detune.value = detune
      play(o, f, at, dur + 0.3)
    }
  }
  const [G4, C5, E5, G5, C6] = [392, 523.25, 659.25, 783.99, 1046.5]
  brass(G4, t, 0.14)
  brass(G4, t + 0.18, 0.14)
  brass(G4, t + 0.36, 0.14)
  brass(C5, t + 0.54, 0.5)
  brass(E5, t + 1.1, 0.16)
  brass(G5, t + 1.3, 0.16)
  for (const f of [C5, E5, G5, C6]) brass(f, t + 1.5, 1.2, 0.08)
  for (const at of [t + 0.54, t + 1.5]) {
    play(tone(ctx, 'sine', 95, at, 55, 0.4), envelope(ctx, out, at, 0.6, 0.004, 0.5), at, 0.5)
  }
}

export function defeat(ctx: Ctx, out: Out, t: number) {
  const horn = (freq: number, at: number, dur: number) => {
    const g = ctx.createGain()
    g.connect(out)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.16, at + 0.12)
    g.gain.linearRampToValueAtTime(0.14, at + dur - 0.1)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.4)
    const f = filterInto(ctx, g, 'lowpass', 650, at)
    const vibrato = tone(ctx, 'sine', 5, at)
    const depth = ctx.createGain()
    depth.gain.value = 4
    vibrato.connect(depth)
    vibrato.start(at)
    vibrato.stop(at + dur + 0.5)
    for (const detune of [-8, 8]) {
      const o = tone(ctx, 'sawtooth', freq, at)
      o.detune.value = detune
      depth.connect(o.detune)
      play(o, f, at, dur + 0.45)
    }
  }
  horn(196, t, 0.7)
  horn(155.56, t + 0.8, 0.7)
  horn(130.81, t + 1.6, 1.6)
  const rumble = ctx.createGain()
  rumble.connect(out)
  rumble.gain.setValueAtTime(0.0001, t)
  rumble.gain.exponentialRampToValueAtTime(0.3, t + 0.8)
  rumble.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
  play(noise(ctx), filterInto(ctx, rumble, 'lowpass', 110, t), t, 3.6)
}
