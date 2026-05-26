'use client'

/**
 * EPL Projects Panel — 6-column Kanban that replaces Asana for the agent fleet.
 *
 * STUB v1 (26 May 2026): renders the signed-off mockup via iframe.
 * See EMERGENT_PROMPTS.md §2 Projects and /mockup/projects-panel-preview.html.
 *
 * Columns: Inbox · Up next · In progress · Waiting · Review · Done (this wk)
 *
 * Aggregator sources:
 *   - cards         → /api/epl/projects           (decisions.yaml + atlas.db tasks)
 *   - subtask hooks → /api/epl/projects/:id/items (per-card detail drawer)
 *
 * Cross-nav: card click opens drawer; "open in maintenance" jumps /maintenance.
 */

import { EplPanelFrame } from './epl-panel-frame'

export function EplProjectsPanel() {
  return (
    <EplPanelFrame
      id="projects"
      title="Projects"
      mockupHref="/mockup/projects-panel-preview.html"
      promptRef="EMERGENT_PROMPTS.md → §2 Projects"
      apiBase="/api/epl/projects"
    />
  )
}
