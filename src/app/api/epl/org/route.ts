/**
 * GET /api/epl/org
 *
 * The org graph for the Agents panel (§8): agent "CV" profiles + the
 * reporting lines between agents (agent_edges, agent->agent) AND between
 * agents and named humans (agent_human_pairings, agent->human). Reads the
 * Supabase brain server-side; combines both edge sources into one graph.
 *
 * Env (first match wins — works with the VPS /opt/shared/.env):
 *   EPL_BRAIN_URL | SUPABASE_URL
 *   EPL_BRAIN_KEY | SUPABASE_SERVICE_ROLE_KEY   (service_role; server-side only)
 *
 * Returns { source, agents, people, edges } where edges unions:
 *   - agent_edges  (to_kind 'agent')   e.g. larry --hands_off_to--> atlas
 *   - agent_human_pairings (to_kind 'human')  e.g. aria --approver--> arianne
 */

import { NextRequest, NextResponse } from 'next/server'

const BRAIN_URL =
  process.env.EPL_BRAIN_URL || process.env.SUPABASE_URL || 'https://blcbvrxssmyqtxemmzzl.supabase.co'
const BRAIN_KEY = process.env.EPL_BRAIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

async function brain(path: string): Promise<any[] | null> {
  if (!BRAIN_KEY) return null
  try {
    const r = await fetch(`${BRAIN_URL}/rest/v1/${path}`, {
      headers: { apikey: BRAIN_KEY, Authorization: `Bearer ${BRAIN_KEY}` },
      cache: 'no-store',
    })
    if (!r.ok) return null
    return (await r.json()) as any[]
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest) {
  const [profiles, edges, pairings, people] = await Promise.all([
    brain('agent_profiles?select=*&order=agent.asc'),
    brain('agent_edges?select=*&order=from_agent.asc'),
    brain('agent_human_pairings?select=*'),
    brain('people?select=id,name,role,company,status'),
  ])

  if (profiles === null) {
    return NextResponse.json({
      source: 'unconfigured',
      note: 'Set EPL_BRAIN_KEY or SUPABASE_SERVICE_ROLE_KEY (service_role) to read agent_profiles / agent_edges / agent_human_pairings.',
      agents: [],
      people: [],
      edges: [],
    })
  }

  const agentEdges = (edges ?? []).map(e => ({
    from: e.from_agent,
    to: e.to_actor,
    to_kind: e.to_kind ?? 'agent',
    type: e.edge_type,
    notes: e.notes ?? null,
  }))
  const humanEdges = (pairings ?? []).map(p => ({
    from: p.agent,
    to: p.person_id,
    to_kind: 'human',
    type: p.pair_role ?? 'paired',
    notes: null,
  }))

  return NextResponse.json({
    source: 'brain',
    generatedAt: new Date().toISOString(),
    agents: profiles,
    people: people ?? [],
    edges: [...agentEdges, ...humanEdges],
    summary: {
      agents: profiles.length,
      agent_edges: agentEdges.length,
      human_edges: humanEdges.length,
    },
  })
}
