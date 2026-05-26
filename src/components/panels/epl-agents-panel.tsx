'use client'

/**
 * EPL Agents Panel — fleet tracker for all 15 agents.
 *
 * Closes Gerda's earlier ask: "tracker for agents since none existed".
 *
 * STUB v1 (26 May 2026): renders the signed-off mockup via iframe.
 * See EMERGENT_PROMPTS.md §6 Agents and /mockup/agents-panel-preview.html.
 *
 * Aggregator sources:
 *   - fleet list      → /api/epl/agents               (15 agents + status + headline + ROADMAP age)
 *   - per-agent       → /api/epl/agents/[name]        (live /api/stats with graceful fallback)
 *   - stale roadmaps  → /api/epl/agents?part=stale-roadmaps (drives Edward's Friday scan reminder)
 *
 * Categories: PA / Finance / Marketing / Revenue / Pricing / Compliance / CoS /
 *             Meta / Cash / QA / Landlord / Onboarding / Acquisition / Maintenance / Research
 *
 * Status pills: ok (green) · review (amber) · offline (slate) · blocked (rose)
 */

import { EplPanelFrame } from './epl-panel-frame'

export function EplAgentsPanel() {
  return (
    <EplPanelFrame
      id="agents-fleet"
      title="Agents (fleet)"
      mockupHref="/mockup/agents-panel-preview.html"
      promptRef="EMERGENT_PROMPTS.md → §6 Agents"
      apiBase="/api/epl/agents"
    />
  )
}
