/**
 * Margin signal reader — single source of truth for the "💰 Margin watch"
 * surface (Today panel section + /api/epl/margin).
 *
 * REAL DATA: reads /atlas-data/breakeven_feed.json, written by Atlas's exporter
 * atlas/scripts/mc_margin_signal.py (the same /atlas-data:ro mount the Properties
 * tiles, Fleet-Health card and maintenance signal use). The feed JOINs Aria's
 * forward break-even (cost_floors.json) to James's achieved occupancy +
 * contribution, and carries an advisory `margin_status` per flat.
 *
 * 🚦 ADVISORY ONLY. This surface reports profitability candidates — it never
 * prices, renegotiates rent, or declares a "rent problem". Per the strict order,
 * a flagged flat is only a candidate for Aria's step-4 lens (after
 * reviews+visibility+price clear). No silent mock: when the export is missing the
 * payload says so via `real: false` and the panel renders an honest empty state.
 *
 * Mirrors src/app/api/epl/schedule/route.ts (same load+mock+parts pattern).
 */
import { readFileSync } from 'node:fs'

export type MarginStatus = 'profitable' | 'thin' | 'below_breakeven' | 'unknown'

export interface MarginProperty {
  property_id: string
  display_name: string
  season: string
  rent_gbp: number | null
  full_breakeven_adr_gbp: number | null
  target_occ_pct: number | null
  achieved_occ_pct: number | null
  monthly_contribution_gbp: number | null
  marginal_floor_gbp: number | null
  achieved_adr_gbp: number | null
  margin_status: MarginStatus
  requires_diagnostic_clearance: boolean
  route_hint: string
}

export interface MarginFeed {
  generated_at: string | null
  advisory_only: boolean
  season: string
  target_occ_pct: number
  achieved_source: string
  data_quality: Record<string, string>
  total_properties: number
  by_status: Partial<Record<MarginStatus, number>>
  properties: MarginProperty[]
  real: boolean
}

const REAL_PATH = process.env.MARGIN_FEED_JSON || '/atlas-data/breakeven_feed.json'

const MOCK: MarginFeed = {
  generated_at: null,
  advisory_only: true,
  season: '',
  target_occ_pct: 75,
  achieved_source: 'absent',
  data_quality: { note: 'MOCK fallback — real export /atlas-data/breakeven_feed.json not found' },
  total_properties: 0,
  by_status: {},
  properties: [],
  real: false,
}

export function loadMarginFeed(): MarginFeed {
  try {
    const raw = JSON.parse(readFileSync(REAL_PATH, 'utf8'))
    if (Array.isArray(raw.properties)) {
      return { ...raw, real: true } as MarginFeed
    }
  } catch {
    // fall through to mock
  }
  return MOCK
}

/** Flats warranting a margin look (worst first) — below_breakeven + thin. */
export function marginWatchlist(feed: MarginFeed): MarginProperty[] {
  const order: Record<MarginStatus, number> = {
    below_breakeven: 0, thin: 1, unknown: 2, profitable: 3,
  }
  return feed.properties
    .filter((p) => p.margin_status === 'below_breakeven' || p.margin_status === 'thin')
    .sort((a, b) => order[a.margin_status] - order[b.margin_status])
}

/**
 * KPI formatter for the Today panel's "Margin watch" card. Honest when the
 * achieved side is absent (forward-only feed → "awaiting James export").
 */
export function marginKpi(feed: MarginFeed): {
  label: 'Flats below break-even'
  value: string
  delta: string
} {
  if (!feed.real) {
    return { label: 'Flats below break-even', value: 'unavailable', delta: 'feed offline' }
  }
  if (feed.achieved_source === 'absent') {
    return {
      label: 'Flats below break-even',
      value: 'awaiting data',
      delta: `${feed.total_properties} flats · achieved side pending James export`,
    }
  }
  const below = feed.by_status.below_breakeven ?? 0
  const thin = feed.by_status.thin ?? 0
  const parts: string[] = []
  if (below > 0) parts.push(`${below} below`)
  if (thin > 0) parts.push(`${thin} thin`)
  return {
    label: 'Flats below break-even',
    value: String(below),
    delta: parts.length ? `${parts.join(' · ')} (advisory)` : 'all clearing break-even',
  }
}
