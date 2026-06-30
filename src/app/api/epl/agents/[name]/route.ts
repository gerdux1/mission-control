/**
 * GET /api/epl/agents/[name]
 *
 * Per-agent detail. Tries the agent's live /api/stats first (with timeout),
 * falls back to fleet snapshot if offline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { tryFetchAgentStats, ROADMAP_AGES } from '../_helpers'
import { readAgentManifest } from '@/lib/atlas-agents-manifest'

const KNOWN_STATS_URLS: Record<string, string> = {
  hugo: process.env.HUGO_STATS_URL || 'http://localhost:8000/api/stats',
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params
  const url = KNOWN_STATS_URLS[name]
  const [live, manifest] = await Promise.all([
    url ? tryFetchAgentStats(url) : Promise.resolve(null),
    readAgentManifest(name),
  ])

  return NextResponse.json({
    name,
    roadmap_age_days: ROADMAP_AGES[name] ?? null,
    stats_source: live ? 'live' : 'mock',
    stats_url: url ?? null,
    // Per-agent manifest (who/capabilities/key-files/how-it-runs/KPIs) from the
    // Atlas export. null when the mount/file is absent — drawer omits the section.
    manifest,
    stats: live ?? {
      agent: name,
      note: 'Agent /api/stats not wired or offline. Returning placeholder.',
    },
  })
}
