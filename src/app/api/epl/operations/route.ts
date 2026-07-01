/**
 * GET /api/epl/operations
 *
 * Kanban data for the Operations project (project_id = 21, prefix OPS).
 * Migrated from Asana's "Operation's Team Calendar" (3,194 tasks).
 *
 * Column mapping — aligned with the Asana workflow sections:
 *   Backlog     ← status: backlog          ("Untitled section")
 *   Requests    ← status: inbox            ("Request" section)
 *   In Progress ← status: assigned | in_progress | awaiting_owner | review | quality_review
 *   Done (30d)  ← status: done, completed_at >= now - 30d  (cap at 100; total_done returned separately)
 *
 * ?q=<search>   case-insensitive title search (server-side)
 * ?part=summary counts only (for KPI strip)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const PROJECT_ID = 21
const DONE_DAYS = 30
const DONE_CAP = 100

type TaskRow = {
  id: number
  title: string
  status: string
  priority: string
  assigned_to: string | null
  created_at: number
  completed_at: number | null
  tags: string | null
  project_ticket_no: number | null
  metadata: string | null
}

export interface OpsCard {
  id: number
  ref: string
  title: string
  assignee: string
  age_days: number
  priority: string
  /** Asana section tags, e.g. "Request" or "Untitled section" */
  sections: string[]
}

export interface OpsColumn {
  id: 'backlog' | 'requests' | 'in_progress' | 'done'
  label: string
  cards: OpsCard[]
  /** For done column: total matching (before cap) */
  total?: number
}

export interface OpsBoardResponse {
  ok: true
  project_id: number
  project_name: string
  generated_at: string
  search: string
  columns: OpsColumn[]
  total_active: number
  total_done: number
}

function ageDays(createdAt: number): number {
  return Math.max(0, Math.floor((Date.now() / 1000 - createdAt) / 86400))
}

function parseSections(metadata: string | null): string[] {
  if (!metadata) return []
  try {
    const m = JSON.parse(metadata)
    const s = m?.asana_sections
    return Array.isArray(s) ? s : []
  } catch {
    return []
  }
}

function mapCard(row: TaskRow): OpsCard {
  return {
    id: row.id,
    ref: row.project_ticket_no ? `OPS-${String(row.project_ticket_no).padStart(3, '0')}` : `#${row.id}`,
    title: row.title,
    assignee: row.assigned_to || 'unassigned',
    age_days: ageDays(row.created_at),
    priority: row.priority,
    sections: parseSections(row.metadata),
  }
}

function matchesSearch(row: TaskRow, q: string): boolean {
  return !q || row.title.toLowerCase().includes(q)
}

function colId(status: string): 'backlog' | 'requests' | 'in_progress' | 'done' | null {
  if (status === 'backlog') return 'backlog'
  if (status === 'inbox') return 'requests'
  if (['assigned', 'in_progress', 'awaiting_owner', 'review', 'quality_review'].includes(status)) return 'in_progress'
  if (status === 'done') return 'done'
  return null
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const part = url.searchParams.get('part')

    const cutoff = Math.floor(Date.now() / 1000) - DONE_DAYS * 86400

    // Active tasks (non-done)
    const activeRows = db.prepare(`
      SELECT id, title, status, priority, assigned_to, created_at, completed_at,
             tags, project_ticket_no, metadata
      FROM tasks
      WHERE project_id = ? AND workspace_id = ?
        AND status NOT IN ('done', 'failed')
      ORDER BY created_at DESC
    `).all(PROJECT_ID, workspaceId) as TaskRow[]

    // Done tasks (last DONE_DAYS days)
    const doneRows = db.prepare(`
      SELECT id, title, status, priority, assigned_to, created_at, completed_at,
             tags, project_ticket_no, metadata
      FROM tasks
      WHERE project_id = ? AND workspace_id = ?
        AND status = 'done'
        AND (completed_at IS NULL OR completed_at >= ?)
      ORDER BY completed_at DESC NULLS LAST
      LIMIT ?
    `).all(PROJECT_ID, workspaceId, cutoff, DONE_CAP) as TaskRow[]

    const totalDoneRow = db.prepare(`
      SELECT COUNT(*) as n FROM tasks
      WHERE project_id = ? AND workspace_id = ? AND status = 'done'
    `).get(PROJECT_ID, workspaceId) as { n: number }

    const total_done = totalDoneRow?.n ?? 0

    if (part === 'summary') {
      return NextResponse.json({
        ok: true,
        total_active: activeRows.length,
        total_done,
        backlog: activeRows.filter(r => r.status === 'backlog').length,
        requests: activeRows.filter(r => r.status === 'inbox').length,
        in_progress: activeRows.filter(r => colId(r.status) === 'in_progress').length,
        done_30d: doneRows.length,
      })
    }

    const columns: OpsColumn[] = [
      { id: 'backlog',     label: 'Backlog',         cards: [] },
      { id: 'requests',    label: 'Requests',         cards: [] },
      { id: 'in_progress', label: 'In Progress',      cards: [] },
      { id: 'done',        label: `Done (${DONE_DAYS}d)`, cards: [], total: total_done },
    ]
    const byId = new Map(columns.map(c => [c.id, c]))

    for (const row of activeRows) {
      if (!matchesSearch(row, q)) continue
      const col = colId(row.status)
      if (col) byId.get(col)!.cards.push(mapCard(row))
    }
    for (const row of doneRows) {
      if (!matchesSearch(row, q)) continue
      byId.get('done')!.cards.push(mapCard(row))
    }

    return NextResponse.json({
      ok: true,
      project_id: PROJECT_ID,
      project_name: 'Operations',
      generated_at: new Date().toISOString(),
      search: q,
      columns,
      total_active: activeRows.filter(r => matchesSearch(r, q)).length,
      total_done,
    } satisfies OpsBoardResponse)
  } catch (err) {
    logger.error({ err }, 'GET /api/epl/operations error')
    return NextResponse.json({ error: 'Failed to load Operations board' }, { status: 500 })
  }
}
