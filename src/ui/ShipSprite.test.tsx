import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PlacedShip } from '../engine/types'
import { Grid } from './Grid'
import { ShipLayer, ShipSprite } from './ShipSprite'
import { shipGridArea } from './shipGeometry'

const carrier: PlacedShip = {
  type: 'carrier',
  length: 5,
  orientation: 'horizontal',
  origin: { row: 2, col: 3 },
}
const sub: PlacedShip = {
  type: 'submarine',
  length: 3,
  orientation: 'vertical',
  origin: { row: 6, col: 0 },
}

describe('shipGridArea', () => {
  it('spans the ship cells, skipping header rows and columns', () => {
    expect(shipGridArea(carrier, 1)).toEqual({ gridRow: '4 / span 1', gridColumn: '5 / span 5' })
    expect(shipGridArea(sub, 0)).toEqual({ gridRow: '7 / span 3', gridColumn: '1 / span 1' })
  })
})

describe('ShipSprite', () => {
  it('draws one sprite per ship, rotated for vertical ships', () => {
    const h = renderToStaticMarkup(<ShipSprite type="carrier" length={5} />)
    expect(h).toContain('viewBox="0 0 500 100"')
    expect(h).not.toContain('rotate(-90)')

    const v = renderToStaticMarkup(
      <ShipSprite type="submarine" length={3} orientation="vertical" />,
    )
    expect(v).toContain('viewBox="0 0 100 300"')
    expect(v).toContain('translate(0 300) rotate(-90)')
  })

  it('only draws wreck damage on sunk ships', () => {
    expect(renderToStaticMarkup(<ShipSprite type="cruiser" length={3} />)).not.toContain(
      'data-wreck',
    )
    const sunk = renderToStaticMarkup(<ShipSprite type="cruiser" length={3} sunk />)
    expect(sunk).toContain('data-wreck')
    expect(sunk).toMatch(/clip-path="url\(#[\w-]+-clip\)"/)
  })
})

describe('Grid ship layer', () => {
  const html = renderToStaticMarkup(
    <Grid
      size={10}
      label="Your fleet"
      getCell={() => ({})}
      ships={[{ ship: carrier }, { ship: sub, sunk: true }]}
    />,
  )

  it('keeps every cell as an interactive gridcell and adds non-interactive sprites', () => {
    expect(html.match(/role="gridcell"/g)).toHaveLength(100)
    const sprites = html.match(/<span[^>]*data-ship="[^"]+"[^>]*>/g) ?? []
    expect(sprites).toHaveLength(2)
    for (const s of sprites) expect(s).toContain('pointer-events-none')
    expect(html).toMatch(/data-ship="carrier"[^>]*grid-row:4 \/ span 1;grid-column:5 \/ span 5/)
    expect(html).toMatch(/data-ship="submarine" data-sunk="true"/)
  })
})

describe('ShipLayer', () => {
  const sunkSub = { ship: sub, sunk: true }

  it('holds a just-sunk wreck back until the shell lands', () => {
    const revealed = renderToStaticMarkup(
      <ShipLayer ships={[{ ...sunkSub, sinking: 'reveal' }]} offset={0} />,
    )
    expect(revealed).toMatch(/data-wreck-reveal="" class="absolute inset-0" style="opacity:0"/)
    expect(revealed.match(/<svg/g)).toHaveLength(1)

    const own = renderToStaticMarkup(
      <ShipLayer ships={[{ ...sunkSub, sinking: 'wreck' }]} offset={0} />,
    )
    expect(own.match(/<svg/g)).toHaveLength(2)
    expect(own.match(/data-wreck=/g)).toHaveLength(1)
  })

  it('draws older wrecks straight away', () => {
    const h = renderToStaticMarkup(<ShipLayer ships={[sunkSub]} offset={0} />)
    expect(h).not.toContain('data-wreck-reveal')
    expect(h).toContain('data-wreck')
  })
})

describe('fleet colors', () => {
  it('draws the team color as accents over the default steel art', () => {
    const plain = renderToStaticMarkup(<ShipSprite type="destroyer" length={2} />)
    const red = renderToStaticMarkup(<ShipSprite type="destroyer" length={2} team="#ef4444" />)
    expect(plain).not.toContain('data-team')
    expect(red).toContain('data-team="#ef4444"')
    expect(red).toContain('#3b4a5e')
    expect(red).toContain('#a3b1c2')
  })

  it('keeps accents on wrecks but not on placement previews', () => {
    const team = '#14b8a6'
    const h = renderToStaticMarkup(
      <div className="grid">
        <ShipLayer
          offset={0}
          ships={[
            { ship: carrier, sunk: true, team },
            { ship: sub, preview: 'valid', team },
          ]}
        />
      </div>,
    )
    expect(h.match(/data-team=/g)).toHaveLength(1)
    expect(h).toContain(`data-team="${team}"`)
    expect(h).toContain(`stroke="${team}8c"`)
  })
})
