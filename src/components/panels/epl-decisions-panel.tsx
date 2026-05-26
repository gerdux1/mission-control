'use client'

/**
 * EPL Decisions Panel — 32 decisions by category + age-risk callout + R1 detail drawer.
 *
 * STUB v1 (26 May 2026): renders the signed-off mockup via iframe.
 * See EMERGENT_PROMPTS.md §5 Decisions and /mockup/decisions-panel-preview.html.
 *
 * Aggregator sources:
 *   - status strip   → /api/epl/decisions?part=summary       (open/decided/blocked counts)
 *   - age-risk       → /api/epl/decisions?part=age-risk       (filter created_at < now - 10d AND status open)
 *   - decision list  → /api/epl/decisions                    (decisions.yaml grouped by category)
 *   - drawer         → /api/epl/decisions/:id                (full decision + atlas recommendation + automation hooks)
 *
 * Atlas recommendation:
 *   When a decision sits open >7d, atlas posts a Slack DM with proposed default + ETA.
 *   Drawer shows the recommendation + 🟢 Approve / 🔴 Reject / 💬 Discuss buttons.
 */

import { EplPanelFrame } from './epl-panel-frame'

export function EplDecisionsPanel() {
  return (
    <EplPanelFrame
      id="decisions"
      title="Decisions"
      mockupHref="/mockup/decisions-panel-preview.html"
      promptRef="EMERGENT_PROMPTS.md → §5 Decisions"
      apiBase="/api/epl/decisions"
    />
  )
}
