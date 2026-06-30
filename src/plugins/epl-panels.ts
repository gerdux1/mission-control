/**
 * EPL Custom Panels Plugin
 *
 * Registers Gerda's custom Mission Control panels:
 *   - today        Personal landing (top 3 actions, agents overnight, KPIs, waiting)
 *   - projects     6-col Kanban (Asana replacement)
 *   - properties   16-tile heat map + Hot/Star callouts
 *   - maintenance  Hugo Phase 3 — Kanban + heat map
 *   - decisions    32-decision queue with Atlas recommendations
 *   - team         Agents + humans building together — people, pairings, hand-offs (Supabase brain)
 *
 * Visual spec: ~/mission-control/mockup/*.html (signed off 26 May 2026)
 * Build runbook: ~/mission-control/JOSE_HANDOFF.md
 * Emergent prompts: ~/mission-control/EMERGENT_PROMPTS.md
 *
 * Bootstrap: imported as a side-effect by src/app/[[...panel]]/page.tsx so
 * registrations run before nav-rail / router lookup.
 */

import { registerNavItems, registerPanel } from '@/lib/plugins'
import { EplTodayPanel } from '@/components/panels/epl-today-panel'
import { EplProjectsPanel } from '@/components/panels/epl-projects-panel'
import { EplPropertiesPanel } from '@/components/panels/epl-properties-panel'
import { EplMaintenancePanel } from '@/components/panels/epl-maintenance-panel'
import { EplDecisionsPanel } from '@/components/panels/epl-decisions-panel'
import { EplAgentsPanel } from '@/components/panels/epl-agents-panel'
import { EplStartHerePanel } from '@/components/panels/epl-start-here-panel'
import { EplTeamPanel } from '@/components/panels/epl-team-panel'
import { EplAccessMapPanel } from '@/components/panels/epl-access-map-panel'
import { EplFleetHealthPanel } from '@/components/panels/fleet-health-card'
import { EplFleetSchedulePanel } from '@/components/panels/fleet-schedule-card'
import { EplTimelinePanel } from '@/components/panels/epl-timeline-panel'
import { EplAgentFeedPanel } from '@/components/panels/epl-agent-feed-panel'
import { EplToolsPanel } from '@/components/panels/epl-tools-panel'
import { EplApprovalsPanel } from '@/components/panels/epl-approvals-panel'
import { EplChatPanel } from '@/components/panels/epl-chat-panel'
import { EplChannelsPanel } from '@/components/panels/epl-channels-panel'
import { cockpitApprovalsEnabled, cockpitChatEnabled } from '@/lib/cockpit-flags'

let _initialised = false

export function initEplPanelsPlugin(): void {
  if (_initialised) return
  _initialised = true

  registerNavItems([
    { id: 'start-here',    label: 'Start here',     groupId: 'core', icon: '📍' },
    { id: 'today',         label: 'Today',          groupId: 'core', icon: '🌅' },
    { id: 'projects',      label: 'Projects',       groupId: 'core', icon: '📋' },
    { id: 'properties',    label: 'Properties',     groupId: 'core', icon: '🏠' },
    { id: 'fleet-health',  label: 'Fleet health',   groupId: 'core', icon: '🖥' },
    { id: 'fleet-schedule', label: 'Fleet schedule', groupId: 'core', icon: '🗓' },
    { id: 'maintenance',   label: 'Maintenance',    groupId: 'core', icon: '🔧' },
    { id: 'decisions',     label: 'Decisions',      groupId: 'core', icon: '🎯' },
    { id: 'team',          label: 'Team',           groupId: 'core', icon: '👥' },
    { id: 'agents-fleet',  label: 'Agents (fleet)', groupId: 'core', icon: '🤖' },
    { id: 'access',        label: 'Setups',         groupId: 'core', icon: '🔑' },
    { id: 'channels',      label: 'Channels',       groupId: 'core', icon: '💬' },
    // Agent cockpit (Phase 1, read-only) — one Atlas export.
    { id: 'cockpit-timeline', label: 'Timeline',   groupId: 'core', icon: '🛤' },
    { id: 'cockpit-feed',     label: 'Agent feed', groupId: 'core', icon: '🔀' },
    { id: 'cockpit-tools',    label: 'Tools',      groupId: 'core', icon: '🔌' },
  ])

  // Phase-2 ACTION panels — scaffold only, registered ONLY when their flag is
  // explicitly ON (default OFF). The interactive chat must not deploy live.
  if (cockpitApprovalsEnabled()) {
    registerNavItems([{ id: 'cockpit-approvals', label: 'Approvals', groupId: 'core', icon: '✅' }])
  }
  if (cockpitChatEnabled()) {
    registerNavItems([{ id: 'cockpit-chat', label: 'Cockpit chat', groupId: 'core', icon: '💬' }])
  }

  registerPanel('start-here',    EplStartHerePanel)
  registerPanel('today',         EplTodayPanel)
  registerPanel('projects',      EplProjectsPanel)
  registerPanel('properties',    EplPropertiesPanel)
  registerPanel('fleet-health',  EplFleetHealthPanel)
  registerPanel('fleet-schedule', EplFleetSchedulePanel)
  registerPanel('maintenance',   EplMaintenancePanel)
  registerPanel('decisions',     EplDecisionsPanel)
  registerPanel('team',          EplTeamPanel)
  registerPanel('agents-fleet',  EplAgentsPanel)
  registerPanel('access',        EplAccessMapPanel)
  registerPanel('channels',      EplChannelsPanel)

  // Agent cockpit (Phase 1, read-only).
  registerPanel('cockpit-timeline', EplTimelinePanel)
  registerPanel('cockpit-feed',     EplAgentFeedPanel)
  registerPanel('cockpit-tools',    EplToolsPanel)

  // Phase-2 scaffold panels — only reachable when flagged ON (default OFF).
  if (cockpitApprovalsEnabled()) registerPanel('cockpit-approvals', EplApprovalsPanel)
  if (cockpitChatEnabled())      registerPanel('cockpit-chat', EplChatPanel)
}

// Self-register on import (matches the side-effect import pattern used by page.tsx).
initEplPanelsPlugin()
