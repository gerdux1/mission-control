/**
 * Property-issues reader — single source of truth for the "🩺 Property issues"
 * per-property panel (TASK-299) and /api/epl/property-issues.
 *
 * REAL DATA: reads /atlas-data/property_issues.json, written by Iris's daily
 * exporter `scripts/export_property_issues.py` (the same /atlas-data:ro mount the
 * Properties tiles, Margin watch and maintenance signal use). The feed unifies,
 * per property: recurring guest-review issues (BOOM, tagged + aged), open Hugo
 * maintenance tasks (MC project 8, joined by nickname) and an optional QC slot.
 *
 * 🛈 READ-ONLY surface. No silent mock: when the export is missing the payload
 * says so via `real: false` and the panel renders an honest empty state.
 *
 * Mirrors src/lib/atlas-margin-signal.ts (same load + mock + parts pattern).
 */
import { readFileSync } from 'node:fs'

/** A recurring guest-review issue on a flat (`i[]`). */
export interface ReviewIssue {
  /** Category code — key into `cat_labels` (e.g. "PM", "Cleaning", "CS"). */
  c: string
  /** Issue name (e.g. "Door/ Window Issue"). */
  n: string
  /** Times the issue recurred. */
  k: number
  /** Last seen, ISO date. */
  l: string
  /** Age in months since the issue first appeared. */
  a: number
  /** 1 = chronic (recurring across a long span), else 0. */
  x: 0 | 1
  /** BOOM review URL for the most recent occurrence (may be ""). */
  u: string
}

/** An open Hugo maintenance task joined to the flat (`mt[]`). */
export interface MaintTask {
  ref: string | null
  sev: string
  status: string
  cat: string
  age_days: number
  title: string
}

/** A quality-check finding (`qc[]`) — populated once QC capture is wired. */
export interface QcFinding {
  area?: string
  issue?: string
  sev?: string
  date?: string
  status?: string
  by?: string
}

export interface PropertyIssues {
  /** Listing nickname (e.g. "Aldgate - Blaze"). */
  p: string
  /** Total reviews. */
  t: number
  /** Unhappy (bad/mid) reviews. */
  unhappy: number
  /** Percent unhappy (feed is sorted by this, worst first). */
  pc: number
  /** Chronic issue count (issues with x=1). */
  cn: number
  i: ReviewIssue[]
  mt: MaintTask[]
  qc: QcFinding[]
}

export interface PropertyIssuesFeed {
  generated_date: string | null
  flats: number
  issue_rows: number
  open_maintenance: number
  qc_findings: number
  /** Category code → human label. */
  cat_labels: Record<string, string>
  properties: PropertyIssues[]
  real: boolean
}

const REAL_PATH = process.env.PROPERTY_ISSUES_JSON || '/atlas-data/property_issues.json'

const MOCK: PropertyIssuesFeed = {
  generated_date: null,
  flats: 0,
  issue_rows: 0,
  open_maintenance: 0,
  qc_findings: 0,
  cat_labels: {},
  properties: [],
  real: false,
}

/** Load the unified per-property issue feed; honest empty state when absent. */
export function loadPropertyIssues(): PropertyIssuesFeed {
  try {
    const raw = JSON.parse(readFileSync(REAL_PATH, 'utf8'))
    if (Array.isArray(raw.properties)) {
      return { ...MOCK, ...raw, real: true } as PropertyIssuesFeed
    }
  } catch {
    // fall through to mock
  }
  return MOCK
}

/** Lightweight counts + freshness for the KPI strip / Today section. */
export function propertyIssuesSummary(feed: PropertyIssuesFeed): {
  real: boolean
  generated_date: string | null
  flats: number
  issue_rows: number
  chronic_issues: number
  open_maintenance: number
  qc_findings: number
  worst: { p: string; pc: number; cn: number } | null
} {
  const chronic = feed.properties.reduce((n, p) => n + (p.cn || 0), 0)
  const worst = feed.properties[0]
    ? { p: feed.properties[0].p, pc: feed.properties[0].pc, cn: feed.properties[0].cn }
    : null
  return {
    real: feed.real,
    generated_date: feed.generated_date,
    flats: feed.flats,
    issue_rows: feed.issue_rows,
    chronic_issues: chronic,
    open_maintenance: feed.open_maintenance,
    qc_findings: feed.qc_findings,
    worst,
  }
}
