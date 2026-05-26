'use client'

/**
 * EPL Properties Panel — 16-tile flat heat map + Hot/Star callouts + detail drawer.
 *
 * STUB v1 (26 May 2026): renders the signed-off mockup via iframe.
 * See EMERGENT_PROMPTS.md §3 Properties and /mockup/properties-panel-preview.html.
 *
 * Aggregator sources (canonical-only — see Aggregator Principle footer in mockup):
 *   - portfolio kpis  → /api/epl/properties?part=kpis     (boom canonical count, james revenue)
 *   - heat map tiles  → /api/epl/properties?part=tiles    (pricelabs occ × james margin × iris score × hugo open)
 *   - drawer detail   → /api/epl/properties/:canonical_id (boom + pricelabs + james + iris + hugo + larry + marcus)
 *
 * Property registry: ONE source = Property Aliases tab in OTA Registry sheet
 * 1cknTr9J6BSkqpHIebo17oNQZJsp4v9CLmGZc-iL6SZA. No new local dicts.
 */

import { EplPanelFrame } from './epl-panel-frame'

export function EplPropertiesPanel() {
  return (
    <EplPanelFrame
      id="properties"
      title="Properties"
      mockupHref="/mockup/properties-panel-preview.html"
      promptRef="EMERGENT_PROMPTS.md → §3 Properties"
      apiBase="/api/epl/properties"
    />
  )
}
