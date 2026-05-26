/**
 * GET /api/epl/decisions
 *
 * 32 decisions by category + age-risk callout + Atlas recommendations.
 * Mock matches /mockup/decisions-panel-preview.html.
 *
 * Wire to:
 *   - decisions.yaml  (or atlas.db.decisions) for the source list
 *   - atlas /recommendation for the AI-suggested default per row
 *
 * Categories: Hugo · Rapid · Architecture · AI Policies · MC build · Maintenance.
 */

import { NextRequest, NextResponse } from 'next/server'

interface Decision {
  id: string
  title: string
  category: 'Hugo' | 'Rapid' | 'Architecture' | 'AI Policies' | 'MC build' | 'Maintenance'
  status: 'open' | 'decided' | 'blocked'
  age_days: number
  owner: string
  recommendation?: string
  default_applied?: string
}

const DECISIONS: Decision[] = [
  { id: 'R1',  title: 'Pacific Estates VAUXHALL — approve draft', category: 'Rapid', status: 'open', age_days: 4, owner: 'Larry',
    recommendation: 'Approve tier=moderate (option_b £1,200 → Arianne cc, needs_gerda_personal_approval=true).' },
  { id: 'R2',  title: 'Hugo Green API signup — go ahead', category: 'Hugo', status: 'open', age_days: 0, owner: 'Jose' },
  { id: 'R3',  title: 'Hill House counter-offer wording', category: 'Rapid', status: 'open', age_days: 11, owner: 'Nathan',
    recommendation: 'Counter at £4,800 PCM (£200 below ask) + 5yr + 2-wk rent free; Atlas drafted v1.' },
  { id: 'R4',  title: 'Hugo VPS systemd + nginx — deploy tonight?', category: 'Hugo', status: 'open', age_days: 0, owner: 'Gerda' },
  { id: 'R5',  title: 'MC custom panel colours — approve heat-state palette', category: 'MC build', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Locked 26 May evening — heat-hot/warm/neutral/cool/cold.' },
  { id: 'R6',  title: 'AI Policies P01 (drafts-only) — go LIVE', category: 'AI Policies', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: LIVE for all agents from Mon 1 Jun.' },
  { id: 'R7',  title: 'Owen agent — approve name + share v2 sheet with SA', category: 'Architecture', status: 'open', age_days: 0, owner: 'Gerda' },
  { id: 'R8',  title: 'Hanna replacement — split into 2 roles (Sales + Exec PA)', category: 'Rapid', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: split confirmed; salary bands pending Gerda.' },
  { id: 'R9',  title: 'Maintenance Slack channel — keep C047DN2FBND or new?', category: 'Maintenance', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Keep existing #maintenance (20 members since 2022).' },
  { id: 'R10', title: 'Hugo £ ceiling — £100 auto-approve / £500 alert?', category: 'AI Policies', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: £100 auto / £500 alert / £500+ requires Gerda.' },
  { id: 'R11', title: 'Hanna replacement JDs — set salary bands', category: 'Rapid', status: 'open', age_days: 0, owner: 'Gerda' },
  { id: 'R12', title: 'Property registry hygiene — TBC flat numbers (Shoreditch studio)', category: 'Architecture', status: 'open', age_days: 0, owner: 'Larry' },
  { id: 'R13', title: 'Atlas Daily Brief — add Kris config (Hugo KPIs)?', category: 'Architecture', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: Yes — Kris brief 09:00 BST with maintenance KPIs.' },
  { id: 'R14', title: 'AI Policies P07 (SLA tiers) — go LIVE', category: 'AI Policies', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: LIVE — operationalises Policy 45 (BAM guest SLA) + sibling Policy 46 (maintenance).' },
  { id: 'R15', title: 'AI Policies P12 (read-existing-first) — go LIVE', category: 'AI Policies', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: LIVE — enforced by Edward Friday scan.' },
  { id: 'R16', title: 'Emergent (Jose) for visual layer — confirmed?', category: 'MC build', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Confirmed — Jose runs Emergent shootout Wk1.' },
  { id: 'R17', title: 'mc.str-agents.com SSO — Cloudflare Access or built-in?', category: 'MC build', status: 'open', age_days: 0, owner: 'Jose', default_applied: 'DEFAULT: Cloudflare Access (Wk3 eval).' },
  { id: 'R18', title: 'Asana sunset date — Wk4 or Wk6?', category: 'MC build', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: Wk4 — once Projects panel ships.' },
  { id: 'R19', title: 'Property Aliases — add SHOREDITCH_STUDIO flat number', category: 'Architecture', status: 'blocked', age_days: 0, owner: 'Dana Connolly (landlord)' },
  { id: 'R20', title: 'Hugo Phase 2 — auto-reassign on no-ack within SLA', category: 'Hugo', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: P0 30min / P1 2h / P2 24h.' },
  { id: 'R21', title: 'BOOM canonical confirmation — Properties panel source of truth', category: 'Architecture', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Confirmed — BOOM canonical for property list; PriceLabs for occupancy (per Feb).' },
  { id: 'R22', title: 'Aria PriceLabs sync — who approves now Hanna gone?', category: 'Architecture', status: 'open', age_days: 19, owner: 'Arianne', default_applied: 'DEFAULT: Arianne takes pricing approver role.' },
  { id: 'R23', title: 'Slack ID Hanna/Abuzar denylist — bake into all agent code', category: 'AI Policies', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Confirmed — INACTIVE_SLACK_IDS = {U07FQ300EVB, U09MSN2EFK6}.' },
  { id: 'R24', title: 'Hugo backfill 12,880-line corpus — when?', category: 'Hugo', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: Tomorrow morning after migration runs.' },
  { id: 'R25', title: 'Maintenance Atlas KPI — show in Kris brief?', category: 'Maintenance', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Confirmed — wired this session.' },
  { id: 'R26', title: 'Exec PA hire — Sofia extension or new agent?', category: 'Architecture', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: human first, then Sofia takes overflow.' },
  { id: 'R27', title: 'Owen Slack channel — #operations or new?', category: 'Architecture', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: #operations.' },
  { id: 'R28', title: 'Token caps per agent (£40-200/mo)', category: 'AI Policies', status: 'open', age_days: 0, owner: 'Gerda', default_applied: 'DEFAULT: £200 Sofia/Atlas; £100 James/Aria/Larry; £40 others.' },
  { id: 'R29', title: 'Iris reactive vs Owen proactive — clear boundaries', category: 'Architecture', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Iris = review-driven; Owen = research-driven. Documented.' },
  { id: 'R30', title: 'Property scoring — Hot/Star/Cold thresholds', category: 'MC build', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Hot = occ>90 AND score>4.5; Star = score>=4.7; Cold = onboarding OR occ<60.' },
  { id: 'R31', title: 'Sofia legal-status drafting rule — patch deployed', category: 'AI Policies', status: 'decided', age_days: 0, owner: 'Gerda', default_applied: 'Shipped 26 May — 2-line ack-and-pass on RRA/lease/S21/S8 notices.' },
  { id: 'R32', title: 'MC custom panels — REACT generation pipeline', category: 'MC build', status: 'open', age_days: 0, owner: 'Jose', default_applied: 'DEFAULT: Jose runs Emergent on each HTML mockup → drops React into src/components/panels/epl-*.tsx.' },
]

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const part = url.searchParams.get('part')

  if (part === 'summary') {
    return NextResponse.json({
      ok: true,
      total: DECISIONS.length,
      open: DECISIONS.filter(d => d.status === 'open').length,
      decided: DECISIONS.filter(d => d.status === 'decided').length,
      blocked: DECISIONS.filter(d => d.status === 'blocked').length,
    })
  }

  if (part === 'age-risk') {
    const aged = DECISIONS.filter(d => d.status === 'open' && d.age_days > 10)
    return NextResponse.json({ aged_count: aged.length, items: aged })
  }

  if (part === 'by-category') {
    const groups: Record<string, Decision[]> = {}
    DECISIONS.forEach(d => {
      if (!groups[d.category]) groups[d.category] = []
      groups[d.category].push(d)
    })
    return NextResponse.json({ groups })
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), decisions: DECISIONS })
}
