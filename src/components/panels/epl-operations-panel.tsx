'use client'

/**
 * EPL Operations Panel — Kanban board for the Operations project (pid=21).
 *
 * 3,194 tasks migrated from Asana "Operation's Team Calendar".
 * Columns map MC statuses to the old Asana workflow sections:
 *   Backlog      ← backlog     ("Untitled section")
 *   Requests     ← inbox       ("Request")
 *   In Progress  ← assigned / in_progress / awaiting_owner / review
 *   Done (30d)   ← done, last 30 days (capped at 100; full count in column header)
 *
 * Read-only. Search + priority filter; both hit the server via ?q= and ?pri=.
 */

import { useEffect, useState, useCallback, useRef } from 'react'

interface OpsCard {
  id: number
  ref: string
  title: string
  assignee: string
  age_days: number
  priority: string
  sections: string[]
}

interface OpsColumn {
  id: 'backlog' | 'requests' | 'in_progress' | 'done'
  label: string
  cards: OpsCard[]
  total?: number
}

interface OpsBoard {
  ok: true
  project_name: string
  generated_at: string
  search: string
  columns: OpsColumn[]
  total_active: number
  total_done: number
}

const PRIORITY_CLASS: Record<string, string> = {
  critical: 'bg-rose-600 text-white',
  urgent:   'bg-rose-500 text-white',
  high:     'bg-orange-500 text-white',
  medium:   'bg-amber-100 text-amber-800',
  low:      'bg-slate-100 text-slate-500',
}

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-rose-600',
  urgent:   'bg-rose-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  low:      'bg-slate-300',
}

const COL_CONFIG: Record<string, {
  topBorder: string
  headerText: string
  countBg: string
  emptyIcon: string
  emptyText: string
}> = {
  backlog:     { topBorder: 'border-t-slate-300',   headerText: 'text-slate-600', countBg: 'bg-slate-100 text-slate-500',   emptyIcon: '📭', emptyText: 'Nothing queued' },
  requests:    { topBorder: 'border-t-blue-400',    headerText: 'text-blue-700',  countBg: 'bg-blue-50 text-blue-600',      emptyIcon: '✓',  emptyText: 'No open requests' },
  in_progress: { topBorder: 'border-t-amber-400',   headerText: 'text-amber-800', countBg: 'bg-amber-50 text-amber-700',    emptyIcon: '🎉', emptyText: 'All clear' },
  done:        { topBorder: 'border-t-slate-300',   headerText: 'text-slate-400', countBg: 'bg-slate-100 text-slate-400',   emptyIcon: '—',  emptyText: 'No recent completions' },
}

function ageBadge(days: number): string {
  if (days >= 30) return 'text-rose-600'
  if (days >= 7)  return 'text-amber-600'
  return 'text-slate-400'
}

function SectionTag({ s }: { s: string }) {
  if (s === 'general' || !s) return null
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-600 border border-violet-100 leading-none">
      {s.toLowerCase()}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const cls = PRIORITY_DOT[priority] ?? 'bg-slate-200'
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-0.5 ${cls}`} />
}

function Card({ card, onClick }: { card: OpsCard; onClick: () => void }) {
  const sections = card.sections
    .map(s => s === 'Untitled section' ? 'general' : s)
    .filter(s => s !== 'general')

  return (
    <button
      onClick={onClick}
      title={card.title}
      className="w-full text-left bg-white rounded-xl border border-slate-150 p-3 shadow-sm hover:shadow hover:border-slate-300 transition-all group"
    >
      <div className="flex items-start gap-2 mb-2">
        <PriorityDot priority={card.priority} />
        <p className="text-sm text-slate-800 leading-snug line-clamp-2 flex-1 group-hover:text-slate-900">
          {card.title}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap pl-3.5">
        {sections.slice(0, 1).map(s => <SectionTag key={s} s={s} />)}
        <span className={`text-[11px] font-medium ${ageBadge(card.age_days)}`}>
          {card.age_days}d
        </span>
        {card.assignee !== 'unassigned' && (
          <span className="text-[11px] text-slate-400 truncate max-w-[72px]">
            · {card.assignee.split(' ')[0]}
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono text-slate-300">{card.ref}</span>
      </div>
    </button>
  )
}

function Column({ col, onCard }: { col: OpsColumn; onCard: (card: OpsCard) => void }) {
  const cfg = COL_CONFIG[col.id]
  const showDoneFooter = col.id === 'done' && col.total !== undefined && col.total > col.cards.length

  return (
    <div className={`flex flex-col min-w-0 bg-slate-50/80 rounded-2xl border border-slate-200 border-t-4 ${cfg.topBorder} overflow-hidden`}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
        <h2 className={`text-[13px] font-semibold flex-1 ${cfg.headerText}`}>{col.label}</h2>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${cfg.countBg}`}>
          {col.cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-[120px] max-h-[calc(100vh-220px)]">
        {col.cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-8 gap-1 text-center">
            <span className="text-xl opacity-40">{cfg.emptyIcon}</span>
            <span className="text-xs text-slate-400 italic">{cfg.emptyText}</span>
          </div>
        ) : (
          col.cards.map(card => <Card key={card.id} card={card} onClick={() => onCard(card)} />)
        )}
      </div>

      {/* Done column footer */}
      {showDoneFooter && (
        <div className="px-3 pb-2 shrink-0">
          <span className="text-[10px] text-slate-400 italic">{col.total} total · showing last 30 days</span>
        </div>
      )}
    </div>
  )
}

function TaskDrawer({ card, onClose }: { card: OpsCard; onClose: () => void }) {
  const sections = card.sections
    .map(s => s === 'Untitled section' ? '' : s)
    .filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto ring-1 ring-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <PriorityDot priority={card.priority} />
              <span className="text-xs font-mono text-slate-400">{card.ref}</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none shrink-0"
            >✕</button>
          </div>

          <h3 className="text-[15px] font-semibold text-slate-900 mb-4 leading-snug">{card.title}</h3>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-slate-400 text-xs uppercase tracking-wide">Priority</dt>
            <dd>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_CLASS[card.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                {card.priority}
              </span>
            </dd>

            <dt className="text-slate-400 text-xs uppercase tracking-wide">Assignee</dt>
            <dd className="text-slate-700">{card.assignee}</dd>

            <dt className="text-slate-400 text-xs uppercase tracking-wide">Age</dt>
            <dd className={`font-medium ${ageBadge(card.age_days)}`}>{card.age_days} days</dd>

            {sections.length > 0 && (
              <>
                <dt className="text-slate-400 text-xs uppercase tracking-wide">Section</dt>
                <dd className="flex gap-1 flex-wrap">
                  {sections.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded text-xs bg-violet-50 text-violet-700 border border-violet-100">
                      {s}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-3">
            <a
              href="/tasks"
              className="text-xs text-sky-600 hover:text-sky-800 underline underline-offset-2"
            >
              Open task board ↗
            </a>
            <span className="text-slate-200">·</span>
            <span className="text-xs text-slate-400">Task #{card.id}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const PRIORITY_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'high',     label: 'High+' },
  { value: 'critical', label: 'Critical only' },
]

function filterByPriority(cards: OpsCard[], filter: string): OpsCard[] {
  if (filter === 'all') return cards
  if (filter === 'high') return cards.filter(c => ['critical', 'urgent', 'high'].includes(c.priority))
  if (filter === 'critical') return cards.filter(c => ['critical', 'urgent'].includes(c.priority))
  return cards
}

export function EplOperationsPanel() {
  const [board, setBoard] = useState<OpsBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [priFilter, setPriFilter] = useState('all')
  const [selectedCard, setSelectedCard] = useState<OpsCard | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (search = '') => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      const url = `/api/epl/operations${params.size ? '?' + params : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setBoard(await res.json())
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSearch = (value: string) => {
    setQ(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(value), 350)
  }

  if (!board && !error) {
    return (
      <div className="p-8 flex items-center gap-3 text-sm text-slate-500">
        <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        Loading Operations board…
      </div>
    )
  }
  if (error && !board) {
    return <div className="p-8 text-sm text-rose-600">Operations board unavailable: {error}</div>
  }
  if (!board) return null

  const columns = board.columns.map(col => ({
    ...col,
    cards: filterByPriority(col.cards, priFilter),
  }))

  const totalActive = columns.slice(0, 3).reduce((n, c) => n + c.cards.length, 0)

  return (
    <div className="p-5 max-w-[1400px] mx-auto h-full flex flex-col gap-3">
      {/* Compact header */}
      <header className="flex items-center gap-3 flex-wrap shrink-0">
        <h1 className="text-lg font-semibold tracking-tight text-slate-800">⚙️ Operations</h1>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="font-medium text-slate-600">{totalActive}</span> active
          <span className="text-slate-200">·</span>
          <span>{board.total_done.toLocaleString()}</span> total done
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Priority filter */}
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden bg-white divide-x divide-slate-200">
            {PRIORITY_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setPriFilter(f.value)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  priFilter === f.value
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            value={q}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search tasks…"
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none w-48 bg-white"
          />
          <button
            onClick={() => load(q)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors bg-white"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Kanban — 4 cols on xl, 2 on md, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 min-h-0">
        {columns.map(col => (
          <Column key={col.id} col={col} onCard={setSelectedCard} />
        ))}
      </div>

      {selectedCard && (
        <TaskDrawer card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  )
}
