'use client'

/**
 * EPL Property-issues Panel (TASK-299) — the unified per-property issue view.
 *
 * Reads /api/epl/property-issues (→ /atlas-data/property_issues.json, Iris's
 * daily export). Each flat shows, in one place: recurring guest-review issues
 * (with chronic / issue-age flags — "⏳ unfixed ≥N mo"), open Hugo maintenance
 * tickets (joined by nickname) and any QC findings.
 *
 * Read-only. Styling matches the EPL Maintenance / Properties panels
 * (white cards, slate text, rounded-2xl).
 */

import { useEffect, useMemo, useState, useCallback } from 'react'

interface ReviewIssue {
  c: string; n: string; k: number; l: string; a: number; x: 0 | 1; u: string
}
interface MaintTask {
  ref: string | null; sev: string; status: string; cat: string; age_days: number; title: string
}
interface QcFinding {
  area?: string; issue?: string; sev?: string; date?: string; status?: string; by?: string
}
interface Property {
  p: string; t: number; unhappy: number; pc: number; cn: number
  i: ReviewIssue[]; mt: MaintTask[]; qc: QcFinding[]
}
interface Feed {
  generated_date: string | null; flats: number; issue_rows: number
  open_maintenance: number; qc_findings: number
  cat_labels: Record<string, string>; properties: Property[]; real: boolean
}

const SEV_CLASS: Record<string, string> = {
  P0: 'bg-rose-600 text-white',
  P1: 'bg-orange-500 text-white',
  P2: 'bg-amber-400 text-amber-950',
  P3: 'bg-slate-300 text-slate-800',
}

const CAT_CLASS: Record<string, string> = {
  PM: 'bg-rose-100 text-rose-800',
  Cleaning: 'bg-sky-100 text-sky-800',
  CS: 'bg-violet-100 text-violet-800',
  Design: 'bg-fuchsia-100 text-fuchsia-800',
  Channel: 'bg-teal-100 text-teal-800',
  Security: 'bg-red-100 text-red-800',
  Outdoor: 'bg-lime-100 text-lime-800',
  General: 'bg-slate-100 text-slate-700',
  Extra: 'bg-slate-100 text-slate-700',
}

/** % unhappy → tile tone (heat). */
function pcTone(pc: number): string {
  if (pc >= 30) return 'bg-rose-600 text-white'
  if (pc >= 20) return 'bg-orange-500 text-white'
  if (pc >= 10) return 'bg-amber-400 text-amber-950'
  return 'bg-emerald-500 text-white'
}

export function EplPropertyIssuesPanel() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [chronicOnly, setChronicOnly] = useState(false)
  const [cat, setCat] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/epl/property-issues', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setFeed(await res.json())
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch property issues')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (p: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })

  const catLabel = useCallback(
    (code: string) => feed?.cat_labels?.[code] || code,
    [feed],
  )

  const filtered = useMemo(() => {
    if (!feed) return []
    const needle = q.trim().toLowerCase()
    return feed.properties.filter(pr => {
      if (needle && !pr.p.toLowerCase().includes(needle)) return false
      if (chronicOnly && pr.cn === 0) return false
      if (cat !== 'all' && !pr.i.some(i => i.c === cat)) return false
      return true
    })
  }, [feed, q, chronicOnly, cat])

  if (!feed && !error) return <div className="p-8 text-sm text-slate-500">Loading property issues…</div>
  if (error && !feed) return <div className="p-8 text-sm text-rose-600">Property issues unavailable: {error}</div>

  const f = feed as Feed

  if (!f.real) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">🩺 Property issues</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm">
          <div className="text-amber-700 font-medium mb-1">No live export yet.</div>
          <div className="text-slate-600">
            Iris&rsquo;s <code>scripts/export_property_issues.py</code> has not written{' '}
            <code>/atlas-data/property_issues.json</code> yet. The panel will populate on the next daily run.
          </div>
        </div>
      </div>
    )
  }

  const cats = Object.keys(f.cat_labels)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">🩺 Property issues</h1>
        {f.generated_date && (
          <span className="text-xs text-slate-400">as of {f.generated_date}</span>
        )}
        <button onClick={load} className="ml-auto text-xs underline text-slate-500 hover:text-slate-700">refresh</button>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Flats with issues" value={String(f.flats)} />
        <Kpi label="Issue rows" value={String(f.issue_rows)} />
        <Kpi label="Chronic issues" value={String(f.properties.reduce((n, p) => n + p.cn, 0))} tone="rose" />
        <Kpi label="Open maintenance" value={String(f.open_maintenance)} tone={f.open_maintenance > 0 ? 'orange' : 'slate'} />
        <Kpi label="QC findings" value={String(f.qc_findings)} />
      </div>

      {/* Toolbar: search + chronic + category */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search property…"
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none w-56"
        />
        <button
          onClick={() => setChronicOnly(v => !v)}
          className={`px-3 py-1 rounded-full text-xs border ${chronicOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
        >
          ⏳ Chronic only
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={() => setCat('all')}
          className={`px-3 py-1 rounded-full text-xs border ${cat === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
        >All</button>
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1 rounded-full text-xs border ${cat === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
            {catLabel(c)}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} of {f.properties.length} flats</span>
      </div>

      {/* Per-property cards (sorted worst-first by the feed) */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-sm text-slate-400 italic">No flats match this filter.</div>
        )}
        {filtered.map(pr => {
          const isOpen = expanded.has(pr.p)
          const visibleIssues = cat === 'all' ? pr.i : pr.i.filter(i => i.c === cat)
          return (
            <div key={pr.p} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggle(pr.p)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition"
              >
                <span className={`px-2 py-1 rounded-lg text-xs font-semibold shrink-0 ${pcTone(pr.pc)}`}>{pr.pc}%</span>
                <span className="font-medium text-slate-800 truncate">{pr.p}</span>
                <span className="text-xs text-slate-400 shrink-0">{pr.unhappy}/{pr.t} unhappy</span>
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  {pr.cn > 0 && <Badge tone="rose">⏳ {pr.cn} chronic</Badge>}
                  <Badge tone="slate">{pr.i.length} issue{pr.i.length === 1 ? '' : 's'}</Badge>
                  {pr.mt.length > 0 && <Badge tone="orange">🔧 {pr.mt.length}</Badge>}
                  {pr.qc.length > 0 && <Badge tone="sky">QC {pr.qc.length}</Badge>}
                  <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-100 space-y-4 pt-3">
                  {/* Review issues */}
                  <section>
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Guest-review issues</div>
                    <div className="space-y-1.5">
                      {visibleIssues.map((i, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${CAT_CLASS[i.c] || 'bg-slate-100 text-slate-700'}`}>{catLabel(i.c)}</span>
                          <span className="text-slate-800 truncate">{i.n}</span>
                          <span className="text-xs text-slate-400 shrink-0">×{i.k}</span>
                          {i.x === 1
                            ? <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 shrink-0" title={`Recurring for ≥${i.a} months`}>⏳ unfixed ≥{i.a} mo</span>
                            : <span className="text-[10px] text-slate-400 shrink-0">{i.a} mo</span>}
                          <span className="text-xs text-slate-300 shrink-0 hidden md:inline">last {i.l}</span>
                          {i.u && (
                            <a href={i.u} target="_blank" rel="noopener noreferrer"
                              className="ml-auto text-xs text-sky-600 hover:text-sky-800 underline shrink-0">BOOM ↗</a>
                          )}
                        </div>
                      ))}
                      {visibleIssues.length === 0 && <div className="text-xs text-slate-400 italic">No issues in this category.</div>}
                    </div>
                  </section>

                  {/* Open maintenance */}
                  {pr.mt.length > 0 && (
                    <section>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Open maintenance (Hugo)</div>
                      <div className="space-y-1.5">
                        {pr.mt.map((m, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {m.sev && <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${SEV_CLASS[m.sev] || 'bg-slate-200 text-slate-700'}`}>{m.sev}</span>}
                            {m.ref && <span className="text-xs text-slate-400 font-mono shrink-0">{m.ref}</span>}
                            <span className="text-slate-800 truncate">{m.title}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 shrink-0">{m.status}</span>
                            <span className="ml-auto text-xs text-slate-400 shrink-0">{m.age_days}d</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* QC findings */}
                  {pr.qc.length > 0 && (
                    <section>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">QC findings</div>
                      <div className="space-y-1.5">
                        {pr.qc.map((qc, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {qc.sev && <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${SEV_CLASS[qc.sev] || 'bg-slate-200 text-slate-700'}`}>{qc.sev}</span>}
                            {qc.area && <span className="text-xs text-slate-400 shrink-0">{qc.area}</span>}
                            <span className="text-slate-800 truncate">{qc.issue}</span>
                            {qc.status && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 shrink-0">{qc.status}</span>}
                            {qc.date && <span className="ml-auto text-xs text-slate-400 shrink-0">{qc.date}</span>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <footer className="text-xs text-slate-400 pt-4 border-t border-slate-100">
        Source: <code>/api/epl/property-issues</code> → <code>/atlas-data/property_issues.json</code> (Iris daily export).
        Read-only · review issues + open Hugo tickets + QC, joined per flat.
      </footer>
    </div>
  )
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'rose' | 'orange' }) {
  const cls = tone === 'rose' ? 'text-rose-700' : tone === 'orange' ? 'text-orange-700' : 'text-slate-900'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'rose' | 'orange' | 'slate' | 'sky' }) {
  const cls = tone === 'rose' ? 'bg-rose-100 text-rose-800'
    : tone === 'orange' ? 'bg-orange-100 text-orange-800'
    : tone === 'sky' ? 'bg-sky-100 text-sky-800'
    : 'bg-slate-100 text-slate-600'
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{children}</span>
}
