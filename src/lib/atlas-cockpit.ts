/**
 * Atlas cockpit reader.
 *
 * Atlas writes /opt/atlas/data/mc_cockpit.json with the live "agent cockpit"
 * export (timeline swimlanes, agent hand-off feed, per-agent connectors, and
 * conversation costs). Mounted into the MC container read-only at /atlas-data
 * (see docker-compose.yml). This module is the single reader.
 *
 * The Atlas exporter is being built in parallel, so the file may not exist yet.
 * This reader returns a graceful EMPTY payload (never throws, never fabricates)
 * when the mount/file is missing or the JSON is invalid — same "no silent mock"
 * discipline as /api/epl/agents: empty state with an honest `source` flag, not
 * canned data dressed up as live.
 *
 * No caching needed: file rewrites periodically, fs read is sub-ms.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

export type CockpitStatus = 'shipped' | 'building' | 'blocked' | 'planned'

export interface CockpitTimelineItem {
  title: string
  status: CockpitStatus
  start_week: number
  end_week: number
}

export interface CockpitTimelineLane {
  agent: string
  items: CockpitTimelineItem[]
}

export interface CockpitFeedEntry {
  ts: string
  from: string
  to: string
  summary: string
  kind: string
  cost_usd: number
}

export interface CockpitConnector {
  name: string
  status: string
}

export interface CockpitToolsEntry {
  agent: string
  connectors: CockpitConnector[]
}

export interface CockpitConversation {
  id: string
  agent: string
  cost_usd: number
  turns: number
  last_ts: string
  title: string
}

export interface CockpitExport {
  generated_at: string
  week_now: number
  timeline: CockpitTimelineLane[]
  agent_feed: CockpitFeedEntry[]
  tools: CockpitToolsEntry[]
  conversations: CockpitConversation[]
}

export interface CockpitPayload extends CockpitExport {
  /** 'live' = read from the Atlas export; 'empty' = mount/file absent or invalid. */
  source: 'live' | 'empty'
}

const DEFAULT_COCKPIT_PATH = '/atlas-data/mc_cockpit.json'

/** Resolved at call time so the path can be overridden per-request/test via env. */
function cockpitFilePath(): string {
  return process.env.ATLAS_COCKPIT_PATH || DEFAULT_COCKPIT_PATH
}

/** The honest empty payload returned when the export is unavailable. */
export function emptyCockpit(): CockpitPayload {
  return {
    generated_at: new Date().toISOString(),
    week_now: isoWeekNow(),
    timeline: [],
    agent_feed: [],
    tools: [],
    conversations: [],
    source: 'empty',
  }
}

/** ISO-8601 week number for "now" — used as a sane default when no export. */
export function isoWeekNow(d: Date = new Date()): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function asNum(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function normStatus(v: unknown): CockpitStatus {
  return v === 'shipped' || v === 'building' || v === 'blocked' || v === 'planned'
    ? v
    : 'planned'
}

/**
 * Coerce a raw parsed object into a clean CockpitExport, dropping malformed
 * rows rather than throwing. A partially-bad export degrades gracefully.
 */
function coerce(raw: Record<string, unknown>): CockpitExport {
  const timeline: CockpitTimelineLane[] = Array.isArray(raw.timeline)
    ? raw.timeline
        .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
        .map((l) => ({
          agent: asStr(l.agent),
          items: Array.isArray(l.items)
            ? l.items
                .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
                .map((i) => ({
                  title: asStr(i.title),
                  status: normStatus(i.status),
                  start_week: asNum(i.start_week),
                  end_week: asNum(i.end_week),
                }))
            : [],
        }))
        .filter((l) => l.agent)
    : []

  const agent_feed: CockpitFeedEntry[] = Array.isArray(raw.agent_feed)
    ? raw.agent_feed
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => ({
          ts: asStr(e.ts),
          from: asStr(e.from),
          to: asStr(e.to),
          summary: asStr(e.summary),
          kind: asStr(e.kind, 'handoff'),
          cost_usd: asNum(e.cost_usd),
        }))
    : []

  const tools: CockpitToolsEntry[] = Array.isArray(raw.tools)
    ? raw.tools
        .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
        .map((t) => ({
          agent: asStr(t.agent),
          connectors: Array.isArray(t.connectors)
            ? t.connectors
                .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
                .map((c) => ({ name: asStr(c.name), status: asStr(c.status, 'unknown') }))
                .filter((c) => c.name)
            : [],
        }))
        .filter((t) => t.agent)
    : []

  const conversations: CockpitConversation[] = Array.isArray(raw.conversations)
    ? raw.conversations
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          id: asStr(c.id),
          agent: asStr(c.agent),
          cost_usd: asNum(c.cost_usd),
          turns: asNum(c.turns),
          last_ts: asStr(c.last_ts),
          title: asStr(c.title),
        }))
        .filter((c) => c.id)
    : []

  return {
    generated_at: asStr(raw.generated_at, new Date().toISOString()),
    week_now: raw.week_now != null ? asNum(raw.week_now, isoWeekNow()) : isoWeekNow(),
    timeline,
    agent_feed,
    tools,
    conversations,
  }
}

export async function readCockpit(): Promise<CockpitPayload> {
  try {
    const rawText = await fs.readFile(cockpitFilePath(), 'utf-8')
    const parsed = JSON.parse(rawText)
    if (!parsed || typeof parsed !== 'object') return emptyCockpit()
    return { ...coerce(parsed as Record<string, unknown>), source: 'live' }
  } catch {
    // Missing mount, missing file, or invalid JSON → honest empty state.
    return emptyCockpit()
  }
}

export function cockpitPath(): string {
  return path.resolve(cockpitFilePath())
}
