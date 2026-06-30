/**
 * GET /api/epl/properties
 *
 * 16-tile heat map + Hot/Star callouts + portfolio KPIs.
 *
 * REAL DATA: reads /atlas-data/mc_properties.json (written hourly by Atlas's
 * exporter atlas/scripts/mc_properties_export.py from James's workbook +
 * the canonical Property Aliases registry). Falls back to the mock tiles
 * below only if that file is absent/unreadable.
 *
 * Aggregator principle (canonical-only):
 *   - flat list      → Property Aliases tab (sheet 1cknTr9J6BSkqpHIebo17oNQZJsp4v9CLmGZc-iL6SZA)
 *   - revenue        → James monthly P&L (net margin, latest populated month)
 *   - occupancy      → James workbook performance sheet (latest populated month)
 *   - guest score    → James workbook Avg Score (Iris not yet wired)
 *   - maintenance    → Hugo (not deployed) → null → shown as "—"
 *   - status         → derived (data-bearing flats = live)
 *
 * Honesty: metrics with no real value are null and render as "—", never
 * fabricated. Each metric's period is in `as_of`. No new local property dicts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { hugoStatsUrl } from '@/lib/maintenance-summary'

type HeatState = 'hot' | 'warm' | 'neutral' | 'cool' | 'cold'

// EPL "brain" (Supabase) — canonical property list, BOOM-sourced. Same creds as /api/epl/org.
const BRAIN_URL = process.env.EPL_BRAIN_URL || process.env.SUPABASE_URL || 'https://blcbvrxssmyqtxemmzzl.supabase.co'
const BRAIN_KEY = process.env.EPL_BRAIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

function brandOf(entity: string | null): Tile['brand'] {
  const e = (entity || '').toLowerCase().replace(/\s+/g, '')
  if (e.includes('staylio')) return 'Staylio'
  if (e.includes('nournest')) return 'NourNest'
  if (e.includes('urban')) return 'UrbanReady'
  return 'EPL'
}

interface Tile {
  canonical_id: string
  display_name: string
  beds: number | null
  brand: 'EPL' | 'Staylio' | 'NourNest' | 'UrbanReady'
  heat: HeatState
  occupancy_30d: number | null  // 0-100
  net_margin_30d: number | null // £ this month
  guest_score: number | null    // 0-5
  open_tickets: number | null
  status: 'live' | 'onboarding' | 'archived'
}

// ── Mock fallback (only served if the real export is missing) ─────────────
const MOCK_TILES: Tile[] = [
  { canonical_id: 'VAUXHALL_1', display_name: '1 Stoddart House',  beds: 2, brand: 'EPL',       heat: 'hot',     occupancy_30d: 92, net_margin_30d: 1800, guest_score: 4.6, open_tickets: 3, status: 'live' },
  { canonical_id: 'MAYFAIR_1',  display_name: 'Mayfair Mansion',   beds: 2, brand: 'EPL',       heat: 'hot',     occupancy_30d: 95, net_margin_30d: 2400, guest_score: 4.9, open_tickets: 0, status: 'live' },
  { canonical_id: 'KINGS_X_63', display_name: '63 Kings Cross',    beds: 1, brand: 'Staylio',   heat: 'warm',    occupancy_30d: 81, net_margin_30d: 1200, guest_score: 4.7, open_tickets: 1, status: 'live' },
  { canonical_id: 'REGENTS_M',  display_name: 'Regents M',         beds: 1, brand: 'Staylio',   heat: 'warm',    occupancy_30d: 78, net_margin_30d: 1100, guest_score: 4.5, open_tickets: 1, status: 'live' },
  { canonical_id: 'PIMLICO_1',  display_name: 'Pimlico Flat',      beds: 1, brand: 'EPL',       heat: 'neutral', occupancy_30d: 71, net_margin_30d:  900, guest_score: 4.4, open_tickets: 0, status: 'live' },
  { canonical_id: 'EUSTON_1',   display_name: 'Euston Flat 1',     beds: 1, brand: 'Staylio',   heat: 'neutral', occupancy_30d: 68, net_margin_30d:  850, guest_score: 4.3, open_tickets: 2, status: 'live' },
  { canonical_id: 'BAKER_2',    display_name: 'Baker St Flat 2',   beds: 3, brand: 'EPL',       heat: 'warm',    occupancy_30d: 83, net_margin_30d: 1700, guest_score: 4.8, open_tickets: 0, status: 'live' },
  { canonical_id: 'RUSSELL_SQ', display_name: 'Russell Square',    beds: 2, brand: 'EPL',       heat: 'cool',    occupancy_30d: 55, net_margin_30d:  650, guest_score: 4.0, open_tickets: 4, status: 'live' },
]

const REAL_PATH = process.env.MC_PROPERTIES_JSON || '/atlas-data/mc_properties.json'

interface LoadResult {
  tiles: Tile[]
  as_of?: Record<string, string>
  sources?: Record<string, unknown>
  counts?: Record<string, unknown>
  generatedAt?: string
  real: boolean
}

interface BrainProp {
  canonical_id: string | null
  nickname: string | null
  display_name: string | null
  bedrooms: number | null
  beds: number | null
  entity: string | null
  status: string | null
  bdc_review_score: number | null
  is_umbrella: boolean | null
  active_flag: boolean | null
}

/** Open maintenance tickets per canonical property, from Hugo (live). Empty on failure. */
async function hugoOpenByProperty(): Promise<Map<string, number>> {
  const url = (process.env.HUGO_TICKETS_URL || hugoStatsUrl().replace('/api/stats', '/api/tickets'))
  const m = new Map<string, number>()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok) {
      const d = await res.json()
      for (const tk of d.tickets ?? []) {
        const k = String(tk.property_id ?? '')
        if (k) m.set(k, (m.get(k) ?? 0) + 1)
      }
    }
  } catch { /* Hugo offline → no ticket counts */ }
  return m
}

/** All canonical flats from the brain (BOOM-sourced), excluding umbrella parents. */
async function fetchBrainTiles(): Promise<Tile[] | null> {
  if (!BRAIN_KEY) return null
  try {
    const sel = 'canonical_id,nickname,display_name,bedrooms,beds,entity,status,bdc_review_score,is_umbrella,active_flag'
    const res = await fetch(`${BRAIN_URL}/rest/v1/properties?select=${sel}&order=nickname.asc`, {
      headers: { apikey: BRAIN_KEY, Authorization: `Bearer ${BRAIN_KEY}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const rows = (await res.json()) as BrainProp[]
    const tickets = await hugoOpenByProperty()
    return rows
      .filter(r => !r.is_umbrella && (r.active_flag ?? true))
      .map((r): Tile => {
        const id = r.canonical_id || r.nickname || 'UNKNOWN'
        const status: Tile['status'] = (r.status || '').toLowerCase() === 'archived' ? 'archived'
          : (r.status || '').toLowerCase() === 'onboarding' ? 'onboarding' : 'live'
        const open = tickets.get(id) ?? null
        return {
          canonical_id: id,
          display_name: r.display_name || r.nickname || id,
          beds: r.bedrooms ?? r.beds ?? null,
          brand: brandOf(r.entity),
          heat: open != null && open >= 3 ? 'cool' : 'neutral',
          occupancy_30d: null,
          net_margin_30d: null,
          guest_score: r.bdc_review_score ?? null,
          open_tickets: open,
          status,
        }
      })
  } catch {
    return null
  }
}

async function loadData(): Promise<LoadResult> {
  // 1. Brain (live, canonical, BOOM-sourced) — the real full portfolio.
  const brain = await fetchBrainTiles()
  if (brain && brain.length > 0) {
    return { tiles: brain, real: true, generatedAt: new Date().toISOString(), sources: { ...REAL_SOURCES, registry: 'Supabase brain properties (BOOM-sourced)', open_tickets: 'Hugo /api/tickets (live)' } }
  }
  // 2. Atlas exporter file fallback.
  try {
    const raw = JSON.parse(readFileSync(REAL_PATH, 'utf8'))
    if (Array.isArray(raw.tiles) && raw.tiles.length > 0) {
      return { tiles: raw.tiles as Tile[], as_of: raw.as_of, sources: raw.sources, counts: raw.counts, generatedAt: raw.generatedAt, real: true }
    }
  } catch { /* fall through */ }
  // 3. Honest mock fallback.
  return { tiles: MOCK_TILES, real: false }
}

const REAL_SOURCES = {
  registry: 'Property Aliases tab (sheet 1cknTr9J6BSkqpHIebo17oNQZJsp4v9CLmGZc-iL6SZA)',
  revenue: 'James monthly P&L',
  occupancy: 'James performance sheet',
  guest_score: 'James Avg Score (Iris not yet wired)',
  open_tickets: 'pending — Hugo not deployed',
  status: 'derived (data-bearing = live)',
}

function callouts(tiles: Tile[]) {
  const hot = tiles.filter(t => t.heat === 'hot').slice(0, 3)
  const star = tiles
    .filter(t => t.status === 'live' && (t.guest_score ?? 0) >= 4.7)
    .sort((a, b) => (b.guest_score ?? 0) - (a.guest_score ?? 0))
    .slice(0, 3)
  const cold = tiles.filter(t => t.heat === 'cold' || t.heat === 'cool').slice(0, 3)
  return { hot, star, cold }
}

export async function GET(req: NextRequest) {
  const { tiles, as_of, sources, counts, generatedAt, real } = await loadData()
  const url = new URL(req.url)
  const part = url.searchParams.get('part')

  if (part === 'kpis') {
    const live = tiles.filter(t => t.status === 'live')
    const occVals = live.map(t => t.occupancy_30d).filter((v): v is number => v != null)
    const scoreVals = live.map(t => t.guest_score).filter((v): v is number => v != null)
    const totalNet = live.reduce((s, t) => s + (t.net_margin_30d ?? 0), 0)
    const ticketsKnown = tiles.map(t => t.open_tickets).filter((v): v is number => v != null)
    return NextResponse.json({
      total: tiles.length,
      live: live.length,
      onboarding: tiles.filter(t => t.status === 'onboarding').length,
      avg_occupancy_30d: occVals.length ? Math.round(occVals.reduce((s, v) => s + v, 0) / occVals.length) : null,
      total_net_margin_30d: totalNet,
      avg_guest_score: scoreVals.length ? Math.round((scoreVals.reduce((s, v) => s + v, 0) / scoreVals.length) * 100) / 100 : null,
      open_tickets: ticketsKnown.length ? ticketsKnown.reduce((s, v) => s + v, 0) : null,
    })
  }

  if (part === 'tiles') {
    return NextResponse.json({ tiles })
  }

  if (part === 'callouts') {
    return NextResponse.json(callouts(tiles))
  }

  if (part === 'summary') {
    return NextResponse.json({ ok: true, tile_count: tiles.length, real })
  }

  return NextResponse.json({
    generatedAt: generatedAt || new Date().toISOString(),
    real,
    as_of,
    tiles,
    callouts: callouts(tiles),
    counts,
    sources: real ? sources : { ...REAL_SOURCES, note: 'MOCK fallback — real export /atlas-data/mc_properties.json not found' },
  })
}
