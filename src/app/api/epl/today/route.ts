/**
 * GET /api/epl/today
 *
 * Aggregator endpoint for the Today panel. Returns Top 3 Actions, Agents Overnight,
 * KPIs, and Waiting-on-you in a single payload (or one part if ?part= is provided).
 *
 * Wired sources (TODO post-Phase 1):
 *   - actions  → atlas.db + sofia urgency queue
 *   - agents   → mc-cli `agents list --json` (calls registered MCs)
 *   - kpis     → atlas /api/stats + hugo /api/stats + james monthly P&L
 *   - waiting  → decisions.yaml filtered by status=open AND age >0d
 *
 * Currently returns canonical mock data that matches /mockup/today-panel-preview.html
 * exactly. Replace with real fetches as each upstream lands.
 */

import { NextRequest, NextResponse } from 'next/server'

const MOCK = {
  generatedAt: new Date().toISOString(),
  actions: [
    { id: 'A1', title: 'Approve Hill House counter-offer wording', why: 'Larry pack ready · landlord call 11:00', cta: 'Open in Decisions', deeplink: '/decisions?id=R3' },
    { id: 'A2', title: 'Confirm 8 RRA receipts to Nathalie', why: 'Friday 10:00 call · 8 receipts queued in Sofia', cta: 'Open Sofia drafts', deeplink: '/chat?agent=sofia' },
    { id: 'A3', title: 'Sign Pacific Estates VAUXHALL draft', why: 'Larry escalation tier · Arianne cc · Atlas waiting', cta: 'Approve in Decisions', deeplink: '/decisions?id=R1' },
  ],
  agentsOvernight: [
    { name: 'Sofia',    role: 'PA',        actions: 14, status: 'ok',     headline: '8 drafts queued for Gerda · 0 sent' },
    { name: 'Atlas',    role: 'CoS',       actions: 11, status: 'ok',     headline: '3 standup posts · 2 Slack relays' },
    { name: 'James',    role: 'Finance',   actions: 6,  status: 'ok',     headline: 'Q1 P&L refresh complete · 1 anomaly flagged' },
    { name: 'Aria',     role: 'Pricing',   actions: 4,  status: 'review', headline: 'PriceLabs sync · waiting on Hanna replacement to approve' },
    { name: 'Larry',    role: 'Landlord',  actions: 3,  status: 'ok',     headline: '6h scan: 1 trigger fired · 2 suppressed' },
    { name: 'Hugo',     role: 'Maint',     actions: 0,  status: 'offline', headline: 'Phase 1 — pending VPS deploy + Green API signup' },
    { name: 'Edward',   role: 'Meta',      actions: 2,  status: 'ok',     headline: 'Friday scan queued · 1 roadmap-stale flag for Sofia' },
  ],
  kpis: [
    { label: 'Open maintenance tickets', value: 'unavailable', delta: 'Hugo offline' },
    { label: 'Cash runway',              value: '14d ok',      delta: '+£3.2k vs forecast' },
    { label: 'Avg star rating (30d)',    value: '4.71',        delta: '−0.04 vs Apr (Iris)' },
    { label: 'Active flats',             value: '50',          delta: '+2 (SHOREDITCH_3, FIVE_BALFOUR_FLAT_2)' },
  ],
  waitingOnYou: [
    { id: 'R1',  title: 'Pacific Estates VAUXHALL draft approval',      age: '2d',  category: 'Landlord',     owner: 'Larry' },
    { id: 'R3',  title: 'Hill House counter-offer wording',              age: '4d',  category: 'Acquisition',  owner: 'Nathan' },
    { id: 'R7',  title: 'Owen agent — approve name + share v2 sheet',    age: '0d',  category: 'Agent build',  owner: 'Owen' },
    { id: 'R11', title: 'Hanna replacement JDs — set salary bands',      age: '0d',  category: 'Hiring',       owner: 'Gerda' },
    { id: 'R14', title: 'AI Policies v1 — approve P01/P07/P12 LIVE',     age: '0d',  category: 'Governance',   owner: 'Atlas' },
  ],
}

export async function GET(req: NextRequest) {
  const part = new URL(req.url).searchParams.get('part')
  if (part === 'actions')   return NextResponse.json({ generatedAt: MOCK.generatedAt, actions: MOCK.actions })
  if (part === 'agents')    return NextResponse.json({ generatedAt: MOCK.generatedAt, agentsOvernight: MOCK.agentsOvernight })
  if (part === 'kpis')      return NextResponse.json({ generatedAt: MOCK.generatedAt, kpis: MOCK.kpis })
  if (part === 'waiting')   return NextResponse.json({ generatedAt: MOCK.generatedAt, waitingOnYou: MOCK.waitingOnYou })
  if (part === 'summary')   return NextResponse.json({ generatedAt: MOCK.generatedAt, ok: true, parts: ['actions', 'agents', 'kpis', 'waiting'] })
  return NextResponse.json(MOCK)
}
