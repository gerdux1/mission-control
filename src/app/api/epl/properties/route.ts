/**
 * GET /api/epl/properties
 *
 * 16-tile heat map + Hot/Star callouts + portfolio KPIs.
 * Mock matches /mockup/properties-panel-preview.html.
 *
 * Aggregator principle (canonical-only):
 *   - flat list      → Property Aliases tab (sheet 1cknTr9J6BSkqpHIebo17oNQZJsp4v9CLmGZc-iL6SZA)
 *   - occupancy      → PriceLabs (Feb confirmed: PriceLabs > BOOM for occ)
 *   - revenue        → James monthly P&L
 *   - guest score    → Iris star_rating + complaint_count
 *   - maintenance    → Hugo /api/stats (open by property)
 *   - status         → agent tracker (per-flat status: live, onboarding, archived)
 *
 * No new local property dicts — registry is the SOT.
 */

import { NextRequest, NextResponse } from 'next/server'

type HeatState = 'hot' | 'warm' | 'neutral' | 'cool' | 'cold'

interface Tile {
  canonical_id: string
  display_name: string
  beds: number
  brand: 'EPL' | 'Staylio' | 'NourNest' | 'UrbanReady'
  heat: HeatState
  occupancy_30d: number  // 0-100
  net_margin_30d: number // £ this month
  guest_score: number    // 0-5
  open_tickets: number
  status: 'live' | 'onboarding' | 'archived'
}

const TILES: Tile[] = [
  { canonical_id: 'VAUXHALL_1', display_name: '1 Stoddart House',  beds: 2, brand: 'EPL',       heat: 'hot',     occupancy_30d: 92, net_margin_30d: 1800, guest_score: 4.6, open_tickets: 3, status: 'live' },
  { canonical_id: 'MAYFAIR_1',  display_name: 'Mayfair Mansion',   beds: 2, brand: 'EPL',       heat: 'hot',     occupancy_30d: 95, net_margin_30d: 2400, guest_score: 4.9, open_tickets: 0, status: 'live' },
  { canonical_id: 'KINGS_X_63', display_name: '63 Kings Cross',    beds: 1, brand: 'Staylio',   heat: 'warm',    occupancy_30d: 81, net_margin_30d: 1200, guest_score: 4.7, open_tickets: 1, status: 'live' },
  { canonical_id: 'REGENTS_M',  display_name: 'Regents M',         beds: 1, brand: 'Staylio',   heat: 'warm',    occupancy_30d: 78, net_margin_30d: 1100, guest_score: 4.5, open_tickets: 1, status: 'live' },
  { canonical_id: 'PIMLICO_1',  display_name: 'Pimlico Flat',      beds: 1, brand: 'EPL',       heat: 'neutral', occupancy_30d: 71, net_margin_30d:  900, guest_score: 4.4, open_tickets: 0, status: 'live' },
  { canonical_id: 'EUSTON_1',   display_name: 'Euston Flat 1',     beds: 1, brand: 'Staylio',   heat: 'neutral', occupancy_30d: 68, net_margin_30d:  850, guest_score: 4.3, open_tickets: 2, status: 'live' },
  { canonical_id: 'BAKER_2',    display_name: 'Baker St Flat 2',   beds: 3, brand: 'EPL',       heat: 'warm',    occupancy_30d: 83, net_margin_30d: 1700, guest_score: 4.8, open_tickets: 0, status: 'live' },
  { canonical_id: 'RUSSELL_SQ', display_name: 'Russell Square',    beds: 2, brand: 'EPL',       heat: 'cool',    occupancy_30d: 55, net_margin_30d:  650, guest_score: 4.0, open_tickets: 4, status: 'live' },
  { canonical_id: 'MAIDA_VALE', display_name: 'Maida Vale',        beds: 1, brand: 'NourNest',  heat: 'warm',    occupancy_30d: 79, net_margin_30d:  950, guest_score: 4.5, open_tickets: 0, status: 'live' },
  { canonical_id: 'ALDGATE_1',  display_name: 'Aldgate Studio',    beds: 0, brand: 'Staylio',   heat: 'neutral', occupancy_30d: 70, net_margin_30d:  700, guest_score: 4.2, open_tickets: 1, status: 'live' },
  { canonical_id: 'SHOREDITCH_3', display_name: 'Flat 5, 223 Shoreditch HS', beds: 3, brand: 'NourNest', heat: 'cold', occupancy_30d: 0, net_margin_30d: 0, guest_score: 0, open_tickets: 0, status: 'onboarding' },
  { canonical_id: 'SHOREDITCH_STUDIO', display_name: '223 Shoreditch HS Studio', beds: 0, brand: 'NourNest', heat: 'cold', occupancy_30d: 0, net_margin_30d: 0, guest_score: 0, open_tickets: 0, status: 'onboarding' },
  { canonical_id: 'FIVE_BALFOUR_FLAT_2', display_name: '5 Balfour Place', beds: 4, brand: 'Staylio', heat: 'cold', occupancy_30d: 0, net_margin_30d: 0, guest_score: 0, open_tickets: 0, status: 'onboarding' },
  { canonical_id: 'OLD_STREET_1', display_name: 'Old Street Flat 1', beds: 1, brand: 'Staylio', heat: 'warm', occupancy_30d: 80, net_margin_30d: 1050, guest_score: 4.6, open_tickets: 0, status: 'live' },
  { canonical_id: 'QUEENS_PARK', display_name: 'Queens Park',     beds: 2, brand: 'EPL',       heat: 'neutral', occupancy_30d: 66, net_margin_30d:  800, guest_score: 4.3, open_tickets: 1, status: 'live' },
  { canonical_id: 'TOWER_HILL',  display_name: 'Tower Hill',      beds: 2, brand: 'EPL',       heat: 'cool',    occupancy_30d: 52, net_margin_30d:  580, guest_score: 4.1, open_tickets: 2, status: 'live' },
]

const HOT = TILES.filter(t => t.heat === 'hot').slice(0, 3)
const STAR = TILES.filter(t => t.guest_score >= 4.7 && t.status === 'live').slice(0, 3)
const COLD = TILES.filter(t => t.heat === 'cold' || t.heat === 'cool').slice(0, 3)

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const part = url.searchParams.get('part')

  if (part === 'kpis') {
    const live = TILES.filter(t => t.status === 'live')
    const onboarding = TILES.filter(t => t.status === 'onboarding')
    const avgOcc = live.length === 0 ? 0 : Math.round(live.reduce((s, t) => s + t.occupancy_30d, 0) / live.length)
    const totalNet = live.reduce((s, t) => s + t.net_margin_30d, 0)
    const avgScore = live.length === 0 ? 0 : (live.reduce((s, t) => s + t.guest_score, 0) / live.length)
    return NextResponse.json({
      total: TILES.length,
      live: live.length,
      onboarding: onboarding.length,
      avg_occupancy_30d: avgOcc,
      total_net_margin_30d: totalNet,
      avg_guest_score: Math.round(avgScore * 100) / 100,
    })
  }

  if (part === 'tiles') {
    return NextResponse.json({ tiles: TILES })
  }

  if (part === 'callouts') {
    return NextResponse.json({ hot: HOT, star: STAR, cold: COLD })
  }

  if (part === 'summary') {
    return NextResponse.json({ ok: true, tile_count: TILES.length })
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    tiles: TILES,
    callouts: { hot: HOT, star: STAR, cold: COLD },
    sources: {
      registry: 'Property Aliases tab (sheet 1cknTr9J6BSkqpHIebo17oNQZJsp4v9CLmGZc-iL6SZA)',
      occupancy: 'PriceLabs daily',
      revenue: 'James monthly P&L',
      guest_score: 'Iris star_rating',
      open_tickets: 'Hugo /api/stats',
      status: 'agent tracker',
    },
  })
}
