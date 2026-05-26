'use client'

/**
 * EPL Today Panel — personal landing for Gerda.
 *
 * STUB v1 (26 May 2026):
 *   Currently serves the signed-off HTML mockup via iframe so Mission Control
 *   shows the canonical visual immediately. Jose will replace this with
 *   Emergent-generated React. See EMERGENT_PROMPTS.md (prompt 1) and
 *   /mockup/today-panel-preview.html for the spec.
 *
 * Aggregator sources (when the React lands):
 *   - Top 3 Actions   → /api/epl/today?part=actions   (atlas.db + sofia urgency)
 *   - Agents overnight → /api/epl/today?part=agents   (mc-cli agents list --json)
 *   - KPIs            → /api/epl/today?part=kpis      (atlas /api/stats + hugo /api/stats)
 *   - Waiting on you  → /api/epl/today?part=waiting   (decisions.yaml age filter >0d)
 *
 * Cross-nav contract: header chips link to /projects /properties /maintenance /decisions
 */

import { EplPanelFrame } from './epl-panel-frame'

export function EplTodayPanel() {
  return (
    <EplPanelFrame
      id="today"
      title="Today"
      mockupHref="/mockup/today-panel-preview.html"
      promptRef="EMERGENT_PROMPTS.md → §1 Today"
      apiBase="/api/epl/today"
    />
  )
}
