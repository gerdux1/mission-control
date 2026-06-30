/**
 * Cross-agent maintenance-block signal reader.
 *
 * Atlas writes /opt/atlas/data/maintenance_blocks.json (scripts/mc_maintenance_signal.py,
 * cron 15m) from MC's own maintenance tasks (project 8). Mounted read-only into MC at
 * /atlas-data/maintenance_blocks.json. Per property with an open P0/P1 ticket it carries
 * ADVISORY labels (pricing_action: 'hold-peak', upsell_action: 'suppress') — a signal for
 * Aria/Iris/a human, NEVER an auto price/messaging change.
 *
 * Never throws, never fabricates: missing/invalid file → null; callers degrade.
 */

import { promises as fs } from 'node:fs'

export interface MaintenanceBlock {
  property_id: string
  max_severity: string
  open_count: number
  categories: string[]
  ticket_ids: string[]
  sample_titles: string[]
  pricing_action: string
  upsell_action: string
}

export interface MaintenanceSignal {
  generated_at: string
  advisory_only: boolean
  guardrail: string
  open_total: number
  by_severity: Record<string, number>
  blocked_count: number
  blocked_properties: MaintenanceBlock[]
}

const DEFAULT_PATH = '/atlas-data/maintenance_blocks.json'

export async function readMaintenanceSignal(): Promise<MaintenanceSignal | null> {
  try {
    const raw = await fs.readFile(process.env.ATLAS_MAINT_SIGNAL_PATH || DEFAULT_PATH, 'utf-8')
    const p = JSON.parse(raw) as MaintenanceSignal
    if (!p || !Array.isArray(p.blocked_properties)) return null
    return p
  } catch {
    return null
  }
}
