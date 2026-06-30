'use client'

/**
 * MarginWatchCard — per-flat profitability "all in one place" on Mission
 * Control, a sibling to Properties / Fleet-health / the maintenance holds.
 *
 * Reads /api/epl/margin?part=watchlist (which loads /atlas-data/breakeven_feed.json,
 * written by Atlas's exporter atlas/scripts/mc_margin_signal.py). The feed JOINs
 * Aria's forward break-even (cost_floors.json) to James's achieved occupancy +
 * monthly contribution, and tags each flat with an advisory margin_status.
 *
 * 🚦 ADVISORY ONLY. This card shows CANDIDATES, never verdicts. Per Gerda's
 * strict order, a flat is a margin/rent question only after Aria clears
 * reviews+visibility+price — so the card never says "lower the rent"; it routes
 * to Aria's step-4 lens. No price or rent is ever changed from here.
 *
 * Styling matches the Fleet-Schedule / Properties cards (rounded-2xl border bg-card).
 */

import { useEffect, useState, useCallback } from 'react'

type MarginStatus = 'profitable' | 'thin' | 'below_breakeven' | 'unknown'

interface MarginProperty {
  property_id: string
  display_name: string
  rent_gbp: number | null
  full_breakeven_adr_gbp: number | null
  achieved_occ_pct: number | null
  monthly_contribution_gbp: number | null
  margin_status: MarginStatus
  route_hint: string
}

interface Watchlist {
  real: boolean
  generated_at: string | null
  watchlist: MarginProperty[]
  guardrail: string
}

const STATUS_STYLE: Record<MarginStatus, { dot: string; label: string }> = {
  below_breakeven: { dot: 'bg-red-500', label: 'below break-even' },
  thin: { dot: 'bg-amber-500', label: 'thin' },
  unknown: { dot: 'bg-zinc-500', label: 'no data' },
  profitable: { dot: 'bg-emerald-500', label: 'profitable' },
}

function gbp(n: number | null): string {
  if (n === null || n === undefined) return '—'
  const sign = n < 0 ? '-' : ''
  return `${sign}£${Math.abs(Math.round(n)).toLocaleString()}`
}

export function MarginWatchCard() {
  const [data, setData] = useState<Watchlist | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/epl/margin?part=watchlist', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch margin feed')
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 300000) // 5m — exporter writes periodically
    return () => clearInterval(interval)
  }, [load])

  if (!data && !error) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 text-sm text-muted-foreground">
        Loading margin watch…
      </div>
    )
  }
  if (error && !data) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 text-sm text-red-400">
        Margin watch unavailable: {error}
      </div>
    )
  }

  const d = data as Watchlist

  if (!d.real) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 text-sm">
        <div className="font-semibold text-foreground mb-1">💰 Margin watch</div>
        <div className="text-amber-400">
          No live export — <code>atlas/scripts/mc_margin_signal.py</code> has not written{' '}
          <code>/atlas-data/breakeven_feed.json</code> yet.
        </div>
      </div>
    )
  }

  const list = d.watchlist || []

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <header className="flex items-start gap-3 p-4 border-b border-border">
        <span className="text-lg leading-none">💰</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">Margin watch</span>
            <span className="text-xs text-muted-foreground">
              {list.length} flat{list.length === 1 ? '' : 's'} to review · advisory
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{d.guardrail}</p>
        </div>
      </header>

      <div className="divide-y divide-border">
        {list.length === 0 && (
          <div className="p-4 text-sm text-emerald-400">
            All flats clearing break-even (or awaiting achieved data).
          </div>
        )}
        {list.map((p) => {
          const st = STATUS_STYLE[p.margin_status]
          return (
            <div key={p.property_id} className="flex items-start gap-3 p-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {p.display_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{st.label}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  contrib {gbp(p.monthly_contribution_gbp)}/mo · break-even ADR{' '}
                  {gbp(p.full_breakeven_adr_gbp)} · occ{' '}
                  {p.achieved_occ_pct === null ? '—' : `${p.achieved_occ_pct}%`} · rent{' '}
                  {gbp(p.rent_gbp)}/mo
                </div>
                <div className="text-[11px] text-muted-foreground/80 mt-0.5 italic">
                  {p.route_hint}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
