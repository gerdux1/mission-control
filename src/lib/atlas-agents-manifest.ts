/**
 * Atlas agent-manifest reader.
 *
 * Atlas writes /opt/atlas/data/mc_agents_manifest.json (scripts/mc_agents_export.py,
 * cron every 30 min) — a per-agent manifest: identity (role/verb/owner/phase/runtime),
 * capabilities (integrations, derived from env-var KEY NAMES only — never secrets),
 * key files (own vs shared), how it runs (services/timers/cron), KPIs, and the latest
 * shipped/blocked/next from each ROADMAP.md. Mounted into the MC container read-only at
 * /atlas-data/mc_agents_manifest.json (same mount as mc_cockpit.json).
 *
 * This reader NEVER throws and NEVER fabricates: a missing/invalid file yields null,
 * and callers degrade gracefully (the drawer just omits the manifest section).
 */

import { promises as fs } from 'node:fs'

export interface AgentManifestEntry {
  name: string
  role: string | null
  verb: string | null
  owner: string | null
  phase: string | null
  runtime: string | null
  capabilities: string[]
  key_files: { own: string[]; shared: string[] }
  how_it_runs: { services: string[]; timers: string[]; cron_files: string[] }
  kpis: string[]
  shipped_recent: string[]
  blocked: string[]
  next: string[]
  has_roadmap: boolean
}

interface ManifestFile {
  generated_at: string
  source: string
  count: number
  agents: AgentManifestEntry[]
}

const DEFAULT_MANIFEST_PATH = '/atlas-data/mc_agents_manifest.json'

function manifestFilePath(): string {
  return process.env.ATLAS_AGENTS_MANIFEST_PATH || DEFAULT_MANIFEST_PATH
}

/** Read the whole manifest, or null if the mount/file is absent or invalid. */
export async function readAgentsManifest(): Promise<ManifestFile | null> {
  try {
    const raw = await fs.readFile(manifestFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as ManifestFile
    if (!parsed || !Array.isArray(parsed.agents)) return null
    return parsed
  } catch {
    return null
  }
}

/** Read one agent's manifest entry by name (case-insensitive), or null. */
export async function readAgentManifest(name: string): Promise<AgentManifestEntry | null> {
  const file = await readAgentsManifest()
  if (!file) return null
  const lower = name.toLowerCase()
  return file.agents.find((a) => a.name.toLowerCase() === lower) ?? null
}
