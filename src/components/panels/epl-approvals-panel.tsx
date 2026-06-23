'use client'

/**
 * EPL Agent Cockpit — Approvals (Phase 2 SCAFFOLD, gated OFF).
 *
 * ⚠️ SCAFFOLD ONLY. Static placeholder. This panel does NOT wire any action
 * POST to Atlas — approve/reject is Phase 2. It is registered only when
 * `cockpitApprovalsEnabled()` is true (default OFF). Even when reached it shows
 * a disabled, read-only mock so nothing actionable ships to prod.
 *
 * Phase-2 plan (NOT built here): approve/reject buttons → guarded POST through a
 * Slack approval gate to Atlas. Do not add network mutations to this file
 * without the Phase-2 sign-off.
 */

import { cockpitApprovalsEnabled } from '@/lib/cockpit-flags'

const MOCK_PENDING = [
  { id: 'apr-001', agent: 'aria', title: 'PriceLabs sync — 12 listings ±4% ADR', risk: 'medium' },
  { id: 'apr-002', agent: 'victoria', title: 'Returning-guest offer — figure pending', risk: 'high' },
  { id: 'apr-003', agent: 'iris', title: 'Auto-publish FAQ — Parking (low-risk)', risk: 'low' },
]

const RISK_CLASS: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  high: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
}

export function EplApprovalsPanel() {
  const enabled = cockpitApprovalsEnabled()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">✅ Approvals</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/30">Phase 2 · scaffold</span>
      </header>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <strong>Not wired.</strong> This is a static scaffold — approve/reject does nothing. Action POSTs to Atlas land in Phase 2 behind a Slack approval gate.
        Flag <code>COCKPIT_APPROVALS_ENABLED</code> is currently <strong>{enabled ? 'ON (preview only)' : 'OFF'}</strong>.
      </div>

      <section className="space-y-2">
        {MOCK_PENDING.map(p => (
          <div key={p.id} className="flex items-center gap-3 bg-card rounded-2xl border border-border px-4 py-3 opacity-70">
            <span className="text-sm font-medium text-foreground capitalize">{p.agent}</span>
            <span className="text-sm text-muted-foreground truncate flex-1">{p.title}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${RISK_CLASS[p.risk]}`}>{p.risk}</span>
            <button disabled className="text-xs px-3 py-1 rounded-lg bg-emerald-600/40 text-white cursor-not-allowed" title="Phase 2 — not wired">Approve</button>
            <button disabled className="text-xs px-3 py-1 rounded-lg bg-rose-600/40 text-white cursor-not-allowed" title="Phase 2 — not wired">Reject</button>
          </div>
        ))}
      </section>

      <footer className="text-xs text-muted-foreground pt-2">Scaffold only · no live data · no Atlas wiring.</footer>
    </div>
  )
}
