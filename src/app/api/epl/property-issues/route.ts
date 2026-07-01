/**
 * GET /api/epl/property-issues — unified per-property issue feed (TASK-299) for
 * the Mission Control "🩺 Property issues" panel.
 *
 * REAL DATA: reads /atlas-data/property_issues.json, written by Iris's daily
 * exporter scripts/export_property_issues.py (the same /atlas-data:ro mount the
 * Properties tiles + Margin watch use). Per property it carries recurring
 * guest-review issues, open Hugo maintenance tasks (joined by nickname) and a QC
 * slot. No silent mock: missing export → `real: false` + honest empty state.
 *
 * Mirrors src/app/api/epl/margin/route.ts (load + parts pattern).
 *
 * ?part=summary → counts + freshness only
 * (default)     → full feed
 */
import { NextRequest, NextResponse } from 'next/server'
import { loadPropertyIssues, propertyIssuesSummary } from '@/lib/property-issues'

export async function GET(req: NextRequest) {
  const feed = loadPropertyIssues()
  const part = new URL(req.url).searchParams.get('part')

  if (part === 'summary') {
    return NextResponse.json(propertyIssuesSummary(feed))
  }

  return NextResponse.json(feed)
}
