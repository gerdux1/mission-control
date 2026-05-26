'use client'

/**
 * EPL Maintenance Panel — Kanban + property heat map + Vauxhall drawer.
 *
 * Phase 3 home of Hugo (dispatch maintenance). When Hugo agent goes live,
 * tickets flow from WhatsApp → Hugo → /api/epl/maintenance.
 *
 * STUB v1 (26 May 2026): renders the signed-off mockup via iframe.
 * See EMERGENT_PROMPTS.md §4 Maintenance and /mockup/maintenance-panel-preview.html.
 *
 * Aggregator sources:
 *   - tickets       → /api/epl/maintenance              (hugo /api/stats + supabase maintenance_tickets)
 *   - property heat → /api/epl/maintenance?part=heat    (open_tickets × severity per property)
 *   - drawer        → /api/epl/maintenance/:ticket_id   (full ticket + photo URLs + history)
 *
 * Severity colours: P0 red · P1 orange · P2 amber · P3 grey.
 * Assignee chips: never show Hanna (U07FQ300EVB) or Sheikh Abuzar dup (U09MSN2EFK6).
 */

import { EplPanelFrame } from './epl-panel-frame'

export function EplMaintenancePanel() {
  return (
    <EplPanelFrame
      id="maintenance"
      title="Maintenance"
      mockupHref="/mockup/maintenance-panel-preview.html"
      promptRef="EMERGENT_PROMPTS.md → §4 Maintenance"
      apiBase="/api/epl/maintenance"
    />
  )
}
