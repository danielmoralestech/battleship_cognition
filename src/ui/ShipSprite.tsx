import { motion } from 'motion/react'
import { useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { wreckRevealMs } from '../effects/timing'
import { facingOf, orientationOf, turnFacing } from '../engine/board'
import type { Facing, Orientation, PlacedShip, ShipType } from '../engine/types'
import { hullPath, shipGridArea } from './shipGeometry'

export type ShipTone = 'valid' | 'invalid'

/** A ship drawn on a board's sprite layer. */
export interface BoardShip {
  ship: PlacedShip
  sunk?: boolean
  /** Original spot of a ship that is currently being dragged. */
  lifted?: boolean
  /** Placement preview: the candidate ship, tinted green or red. */
  preview?: ShipTone
  /**
   * Sunk by the latest shot: hold the wreck back until the shell has landed. `reveal` fades it in
   * from nothing (a hidden enemy ship); `wreck` keeps the intact ship until then.
   */
  sinking?: 'reveal' | 'wreck'
}

/** SVG units per board cell. Sprites are drawn bow-right and rotated for vertical ships. */
const U = 100

interface Hull {
  beam: number
  bow: number
  /** Stern corner radius. */
  stern: number
}

const HULLS: Record<ShipType, Hull> = {
  carrier: { beam: 76, bow: 90, stern: 4 },
  battleship: { beam: 62, bow: 100, stern: 5 },
  cruiser: { beam: 54, bow: 82, stern: 5 },
  submarine: { beam: 44, bow: 90, stern: 16 },
  destroyer: { beam: 48, bow: 70, stern: 5 },
}

interface Palette {
  hull: string
  deckLight: string
  deckDark: string
  structure: string
  structureTop: string
  detail: string
  marking: string
  accent: string
}

const STEEL: Palette = {
  hull: '#3b4a5e',
  deckLight: '#a3b1c2',
  deckDark: '#6b7b8f',
  structure: '#cbd5e1',
  structureTop: '#eef2f7',
  detail: '#1e293b',
  marking: '#f8fafc',
  accent: '#7dd3fc',
}

const SUB: Palette = {
  ...STEEL,
  hull: '#0f172a',
  deckLight: '#475569',
  deckDark: '#1e293b',
  structure: '#334155',
  structureTop: '#64748b',
}

const WRECK: Palette = {
  hull: '#2a211c',
  deckLight: '#86766a',
  deckDark: '#433730',
  structure: '#6b5f57',
  structureTop: '#9c8f85',
  detail: '#0c0a09',
  marking: '#a8a29e',
  accent: '#f97316',
}

const TONES: Record<ShipTone, string> = { valid: '#34d399', invalid: '#f87171' }

function Turret({
  x,
  dir,
  p,
  r = 13,
  barrel = 36,
}: {
  x: number
  dir: 1 | -1
  p: Palette
  r?: number
  barrel?: number
}) {
  const bx = dir === 1 ? x : x - barrel
  return (
    <g>
      <rect x={bx} y={44} width={barrel} height={4} rx={2} fill={p.detail} />
      <rect x={bx} y={52} width={barrel} height={4} rx={2} fill={p.detail} />
      <circle cx={x} cy={50} r={r} fill={p.structure} stroke={p.detail} strokeWidth={3} />
      <circle cx={x - dir * 3} cy={47} r={r * 0.45} fill={p.structureTop} opacity={0.7} />
    </g>
  )
}

function Helipad({ x, p }: { x: number; p: Palette }) {
  return (
    <g stroke={p.marking} strokeWidth={2.5} fill="none" opacity={0.65}>
      <circle cx={x} cy={50} r={15} />
      <path d={`M${x - 6} 42 v16 M${x + 6} 42 v16 M${x - 6} 50 h12`} />
    </g>
  )
}

function Details({
  type,
  w,
  p,
  simple,
}: {
  type: ShipType
  w: number
  p: Palette
  simple: boolean
}) {
  switch (type) {
    case 'carrier':
      return (
        <g>
          {!simple && (
            <>
              <path d="M52 64 L330 20" stroke={p.marking} strokeWidth={2} opacity={0.5} />
              <path d="M58 76 L342 32" stroke={p.marking} strokeWidth={2} opacity={0.5} />
              <path
                d="M55 70 L336 26"
                stroke="#fbbf24"
                strokeWidth={2.5}
                strokeDasharray="14 10"
                opacity={0.85}
              />
              <path
                d={`M30 50 H${w - 70}`}
                stroke={p.marking}
                strokeWidth={2.5}
                strokeDasharray="18 12"
                opacity={0.6}
              />
              <path
                d={`M${w - 120} 38 H${w - 40} M${w - 120} 60 H${w - 40}`}
                stroke={p.marking}
                strokeWidth={2}
                opacity={0.45}
              />
              <rect x={128} y={72} width={34} height={12} rx={2} fill={p.detail} opacity={0.55} />
              <rect x={372} y={18} width={32} height={12} rx={2} fill={p.detail} opacity={0.55} />
              {[200, 232, 400].map((x) => (
                <path
                  key={x}
                  d={`M${x} ${x > 300 ? 72 : 32} l-16 -9 l3 9 l-3 9 Z`}
                  fill={p.structure}
                  opacity={0.85}
                />
              ))}
            </>
          )}
          <rect x={262} y={70} width={78} height={17} rx={3} fill={p.detail} opacity={0.5} />
          <rect x={266} y={68} width={70} height={15} rx={3} fill={p.structure} />
          <rect x={286} y={71} width={26} height={9} rx={2} fill={p.structureTop} />
          {!simple && <circle cx={299} cy={75.5} r={4} fill={p.accent} />}
        </g>
      )
    case 'battleship':
      return (
        <g>
          {!simple && (
            <>
              <path d={`M20 50 H${w - 40}`} stroke={p.detail} strokeWidth={1.5} opacity={0.35} />
              <Turret x={78} dir={-1} p={p} />
              <Turret x={292} dir={1} p={p} />
              <Turret x={340} dir={1} p={p} r={11} barrel={30} />
              {[140, 260].map((x) => (
                <g key={x} fill={p.structure}>
                  <circle cx={x} cy={27} r={4.5} />
                  <circle cx={x} cy={73} r={4.5} />
                </g>
              ))}
            </>
          )}
          <rect x={132} y={33} width={118} height={34} rx={7} fill={p.detail} opacity={0.45} />
          <rect x={128} y={31} width={118} height={34} rx={7} fill={p.structure} />
          <ellipse cx={168} cy={48} rx={15} ry={10} fill={p.detail} />
          <rect x={198} y={38} width={38} height={20} rx={4} fill={p.structureTop} />
          {!simple && <circle cx={217} cy={48} r={4} fill={p.accent} />}
        </g>
      )
    case 'cruiser':
      return (
        <g>
          {!simple && (
            <>
              <Helipad x={42} p={p} />
              {[0, 1, 2].map((i) =>
                [0, 1].map((j) => (
                  <rect
                    key={`${i}${j}`}
                    x={180 + i * 11}
                    y={40 + j * 11}
                    width={8}
                    height={8}
                    rx={1}
                    fill={p.detail}
                    opacity={0.6}
                  />
                )),
              )}
              <Turret x={238} dir={1} p={p} r={10} barrel={30} />
            </>
          )}
          <rect x={92} y={36} width={72} height={30} rx={6} fill={p.detail} opacity={0.45} />
          <rect x={88} y={34} width={72} height={30} rx={6} fill={p.structure} />
          <rect x={118} y={40} width={30} height={18} rx={3} fill={p.structureTop} />
          {!simple && <circle cx={133} cy={49} r={4.5} fill={p.accent} />}
        </g>
      )
    case 'submarine':
      return (
        <g>
          {!simple && (
            <>
              <rect x={0} y={46} width={30} height={8} rx={3} fill={p.detail} />
              <rect
                x={16}
                y={21}
                width={9}
                height={58}
                rx={4}
                fill={p.deckDark}
                stroke={p.detail}
                strokeWidth={2}
              />
              <path
                d={`M40 50 H${w - 70}`}
                stroke={p.structureTop}
                strokeWidth={1.5}
                opacity={0.35}
              />
              {[90, 110, 130].map((x) => (
                <circle key={x} cx={x} cy={50} r={3} fill={p.detail} opacity={0.8} />
              ))}
              <rect
                x={190}
                y={32}
                width={9}
                height={36}
                rx={4}
                fill={p.structure}
                stroke={p.detail}
                strokeWidth={2}
              />
            </>
          )}
          <rect
            x={166}
            y={40}
            width={58}
            height={20}
            rx={10}
            fill={p.structure}
            stroke={p.detail}
            strokeWidth={2.5}
          />
          <rect x={176} y={45} width={34} height={8} rx={4} fill={p.structureTop} opacity={0.8} />
        </g>
      )
    case 'destroyer':
      return (
        <g>
          {!simple && (
            <>
              <Helipad x={34} p={p} />
              <Turret x={146} dir={1} p={p} r={9} barrel={26} />
            </>
          )}
          <rect x={66} y={37} width={52} height={28} rx={5} fill={p.detail} opacity={0.45} />
          <rect x={62} y={35} width={52} height={28} rx={5} fill={p.structure} />
          <ellipse cx={78} cy={49} rx={9} ry={7} fill={p.detail} />
          {!simple && <circle cx={101} cy={49} r={4} fill={p.accent} />}
        </g>
      )
  }
}

/** Charring, a hull breach and smouldering embers, clipped to the hull. */
function Damage({
  w,
  uid,
  top,
  bot,
  simple,
}: {
  w: number
  uid: string
  top: number
  bot: number
  simple: boolean
}) {
  const cells = w / U
  const crackX = w * 0.56
  return (
    <g data-wreck="" clipPath={`url(#${uid}-clip)`}>
      <rect x={0} y={0} width={w} height={U} fill="#0c0a09" opacity={0.15} />
      {Array.from({ length: cells }, (_, i) => (
        <ellipse
          key={i}
          cx={U * i + (i % 2 ? 62 : 38)}
          cy={i % 2 ? 60 : 40}
          rx={34}
          ry={24}
          fill={`url(#${uid}-scorch)`}
        />
      ))}
      <path
        d={`M${crackX} ${top - 2} L${crackX + 12} ${top + 14} L${crackX - 8} 50 L${crackX + 10} ${bot - 14} L${crackX - 2} ${bot + 2}`}
        fill="none"
        stroke="#0c0a09"
        strokeWidth={simple ? 10 : 7}
        strokeLinejoin="round"
      />
      {!simple && (
        <>
          <path
            d={`M${crackX} ${top - 2} L${crackX + 12} ${top + 14} L${crackX - 8} 50 L${crackX + 10} ${bot - 14} L${crackX - 2} ${bot + 2}`}
            fill="none"
            stroke="#ea580c"
            strokeWidth={1.5}
            opacity={0.8}
          />
          <path d={`M${U * 0.6} ${top - 2} l16 14 l12 -14 Z`} fill="#0c0a09" />
          <path d={`M${w - U * 0.9} ${bot + 2} l14 -13 l14 13 Z`} fill="#0c0a09" />
          {Array.from({ length: cells }, (_, i) => (
            <g key={i}>
              <circle cx={U * i + 30} cy={i % 2 ? 36 : 62} r={3.5} fill="#f97316" opacity={0.85} />
              <circle cx={U * i + 70} cy={i % 2 ? 58 : 44} r={2.5} fill="#fbbf24" opacity={0.75} />
            </g>
          ))}
        </>
      )}
    </g>
  )
}

interface ShipSpriteProps {
  type: ShipType
  length: number
  orientation?: Orientation
  /** Overrides `orientation`; defaults to east (horizontal) or north (vertical). */
  facing?: Facing
  sunk?: boolean
  tone?: ShipTone
  /** Hull and main superstructure only, for very small boards. */
  simple?: boolean
  className?: string
  style?: CSSProperties
}

/** Top-down silhouette of a whole ship, stretched to fill its box. */
export function ShipSprite({
  type,
  length,
  orientation = 'horizontal',
  facing,
  sunk = false,
  tone,
  simple = false,
  className = '',
  style,
}: ShipSpriteProps) {
  const uid = useId().replace(/[^\w-]/g, '')
  const w = length * U
  const heading = facing ?? facingOf({ orientation })
  const vertical = orientationOf(heading) === 'vertical'
  const { beam, bow, stern } = HULLS[type]
  const top = 50 - beam / 2
  const bot = 50 + beam / 2
  const p = sunk ? WRECK : type === 'submarine' ? SUB : STEEL
  const x0 = 5
  const x1 = w - 4
  const hull = hullPath(x0, x1, top, bot, bow, stern)
  const deck = hullPath(x0 + 5, x1 - 9, top + 5, bot - 5, bow - 10, Math.max(stern - 3, 2))

  let body: ReactNode = (
    <>
      <path d={hull} transform="translate(4 5)" fill="#020617" opacity={0.4} />
      <path
        d={hull}
        fill={p.hull}
        stroke={sunk ? '#9a3412' : '#020617'}
        strokeWidth={sunk ? 4 : 3}
        strokeLinejoin="round"
      />
      <path d={deck} fill={`url(#${uid}-deck)`} />
      <Details type={type} w={w} p={p} simple={simple} />
      {sunk && <Damage w={w} uid={uid} top={top} bot={bot} simple={simple} />}
      {tone && (
        <path
          d={hull}
          fill={TONES[tone]}
          fillOpacity={0.45}
          stroke={TONES[tone]}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      )}
    </>
  )
  // The art is drawn bow-east; turn it to face the ship's heading.
  const turn = {
    east: '',
    west: `rotate(180 ${w / 2} ${U / 2})`,
    north: `translate(0 ${w}) rotate(-90)`,
    south: `translate(${U} 0) rotate(90)`,
  }[heading]
  if (turn) body = <g transform={turn}>{body}</g>

  return (
    <svg
      viewBox={vertical ? `0 0 ${U} ${w}` : `0 0 ${w} ${U}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`block ${className}`}
      style={style}
      data-sprite={type}
    >
      <defs>
        <linearGradient id={`${uid}-deck`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.deckLight} />
          <stop offset="1" stopColor={p.deckDark} />
        </linearGradient>
        {sunk && (
          <>
            <clipPath id={`${uid}-clip`}>
              <path d={hull} />
            </clipPath>
            <radialGradient id={`${uid}-scorch`}>
              <stop offset="0" stopColor="#0c0a09" stopOpacity={0.8} />
              <stop offset="0.6" stopColor="#1c1917" stopOpacity={0.45} />
              <stop offset="1" stopColor="#1c1917" stopOpacity={0} />
            </radialGradient>
          </>
        )}
      </defs>
      {body}
    </svg>
  )
}

/** Ship sprites for a Grid; absolutely positioned in the cells' grid areas, under shot markers. */
export function ShipLayer({
  ships,
  offset,
  simple,
}: {
  ships: BoardShip[]
  offset: number
  simple?: boolean
}) {
  return ships.map((s) => (
    <ShipSlot
      key={`${s.ship.type}${s.preview ? '-preview' : ''}`}
      {...s}
      offset={offset}
      simple={simple}
    />
  ))
}

const TURN_MS = 220

function ShipSlot({
  ship,
  sunk,
  lifted,
  preview,
  sinking,
  offset,
  simple,
}: BoardShip & { offset: number; simple?: boolean }) {
  const facing = facingOf(ship)
  const el = useRef<HTMLSpanElement>(null)
  const prev = useRef({ facing, lifted })

  // Swing the sprite from its old heading into the new one. Drops of a dragged ship skip
  // this: the drag ghost already showed the new heading.
  useLayoutEffect(() => {
    const before = prev.current
    prev.current = { facing, lifted }
    if (before.facing === facing || before.lifted) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const from =
      turnFacing(before.facing, 1) === facing
        ? -90
        : turnFacing(before.facing, -1) === facing
          ? 90
          : 180
    el.current?.animate?.([{ transform: `rotate(${from}deg)` }, { transform: 'none' }], {
      duration: TURN_MS,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    })
  }, [facing, lifted])

  const sprite = (wreck?: boolean) => (
    <ShipSprite
      type={ship.type}
      length={ship.length}
      orientation={ship.orientation}
      facing={facing}
      sunk={wreck}
      tone={preview}
      simple={simple}
      className="size-full"
    />
  )
  const fade = sunk &&
    sinking && {
      delay: wreckRevealMs(ship.length) / 1000,
      duration: 0.35,
    }
  return (
    <span
      ref={el}
      data-ship={ship.type}
      data-sunk={sunk || undefined}
      data-preview={preview}
      data-facing={facing}
      className={`pointer-events-none absolute inset-0 z-[1] transition-opacity ${lifted ? 'opacity-40' : ''}`}
      style={shipGridArea(ship, offset)}
    >
      {fade && sinking === 'wreck' && (
        <motion.span
          className="absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={fade}
        >
          {sprite(false)}
        </motion.span>
      )}
      {fade ? (
        <motion.span
          data-wreck-reveal=""
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
        >
          {sprite(true)}
        </motion.span>
      ) : (
        sprite(sunk)
      )}
    </span>
  )
}
