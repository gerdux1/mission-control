/**
 * GET /api/epl/margin — Margin watch (per-flat profitability) for the Mission
 * Control dashboard.
 *
 * REAL DATA: reads /atlas-data/breakeven_feed.json, written by Atlas's exporter
 * atlas/scripts/mc_margin_signal.py (the same /atlas-data:ro mount the Properties
 * tiles + maintenance signal use). JOINs Aria forward break-even × James achieved
 * contribution; carries an advisory `margin_status` per flat.
 *
 * 🚦 ADVISORY ONLY — reports candidates, never prices or renegotiates rent. No
 * silent mock: missing export → `real: false` and an honest empty state.
 *
 * Mirrors src/app/api/epl/schedule/route.ts (load+mock+parts pattern).
 *
 * ?part=summary  → counts + freshness
 * ?part=watchlist → below_breakeven + thin flats, worst first
 * (default)      → full feed
 */
import { NextRequest, NextResponse } from 'next/server'
import { loadMarginFeed, marginWatchlist, marginKpi } from '@/lib/atlas-margin-signal'

export async function GET(req: NextRequest) {
  const feed = loadMarginFeed()
  const part = new URL(req.url).searchParams.get('part')

  if (part === 'summary') {
    return NextResponse.json({
      real: feed.real,
      generated_at: feed.generated_at,
      season: feed.season,
      achieved_source: feed.achieved_source,
      total_properties: feed.total_properties,
      by_status: feed.by_status,
      kpi: marginKpi(feed),
      advisory_only: feed.advisory_only,
    })
  }
  if (part === 'watchlist') {
    return NextResponse.json({
      real: feed.real,
      generated_at: feed.generated_at,
      watchlist: marginWatchlist(feed),
      advisory_only: feed.advisory_only,
      guardrail:
        'Advisory candidates only — Aria clears reviews+visibility+price before any rent action.',
    })
  }

  return NextResponse.json(feed)
}
