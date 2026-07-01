'use client'

/**
 * EPL Operations Panel — Kanban board for the Operations project (pid=21).
 *
 * 3,194 tasks migrated from Asana "Operation's Team Calendar".
 * Columns map MC statuses to the old Asana workflow sections:
 *   Backlog      ← backlog     ("Untitled section")
 *   Requests     ← inbox       ("Request")
 *   In Progress  ← assigned / in_progress / awaiting_owner / review
 *   Done (30d)   ← done, last 30 days (capped at 100; full count shown in header)
 *
 * Read-only. Search filters titles client-side for active tasks; server-side
 * for done (via ?q= param which the API handles server-side on full set).
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
  medium:   'bg-amber-400 text-amber-950',
  low:      'bg-slate-200 text-slate-600',
}

const COL_ACCENT: Record<string, string> = {
  backlog:     'border-t-slate-400',
  requests:    'border-t-blue-500',
  in_progress: 'border-t-yellow-500',
  done:        'border-t-emerald-500',
}

const COL_COUNT_CLASS: Record<string, string> = {
  backlog:     'bg-slate-100 text-slate-600',
  requests:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-800',
  done:        'bg-emerald-100 text-emerald-800',
}

function ageBadge(days: number): string {
  if (days >= 30) return 'bg-rose-100 text-rose-800'
  if (days >= 7) return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function SectionTag({ s }: { s: string }) {
  const label = s === 'Untitled section' ? 'general' : s.toLowerCase()
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-700 border border-violet-100">
      {label}
    </span>
  )
}

function Card({ card, onClick }: { card: OpsCard; onClick: () => void }) {
  const pClass = PRIORITY_CLASS[card.priority] ?? 'bg-slate-200 text-slate-600'
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-mono text-slate-400 shrink-0">{card.ref}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${pClass}`}>
          {card.priority}
        </span>
      </div>
      <p className="text-sm text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-slate-900">
        {card.title}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {card.sections.slice(0, 1).map(s => <SectionTag key={s} s={s} />)}
        <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${ageBadge(card.age_days)}`}>
          {card.age_days}d
        </span>
        {card.assignee !== 'unassigned' && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 truncate max-w-[80px]">
            {card.assignee}
          </span>
        )}
      </div>
    </button>
  )
}

function Column({ col, onCard }: { col: OpsColumn; onCard: (card: OpsCard) => void }) {
  const accentClass = COL_ACCENT[col.id] ?? 'border-t-slate-300'
  const countClass = COL_COUNT_CLASS[col.id] ?? 'bg-slate-100 text-slate-600'
  const showTotal = col.id === 'done' && col.total !== undefined && col.total > col.cards.length
  return (
    <div className={`flex flex-col min-w-0 bg-slate-50 rounded-2xl border border-slate-200 border-t-4 ${accentClass} overflow-hidden`}>
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-slate-700 flex-1">{col.label}</h2>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${countClass}`}>
          {col.cards.length}
        </span>
      </div>
      {showTotal && (
        <div className="px-3 pb-1">
          <span className="text-[10px] text-slate-400">{col.total} total — showing last 30d</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)]">
        {col.cards.length === 0 && (
          <div className="text-xs text-slate-400 italic pt-3 text-center">No tasks</div>
        )}
        {col.cards.map(card => (
          <Card key={card.id} card={card} onClick={() => onCard(card)} />
        ))}
      </div>
    </div>
  )
}

function TaskDrawer({ card, onClose }: { card: OpsCard; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-slate-400">{card.ref}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-3 leading-snug">{card.title}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Assignee</dt>
            <dd className="text-slate-800">{card.assignee}</dd>
            <dt className="text-slate-500">Priority</dt>
            <dd>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_CLASS[card.priority] ?? 'bg-slate-200 text-slate-600'}`}>
                {card.priority}
              </span>
            </dd>
            <dt className="text-slate-500">Age</dt>
            <dd className="text-slate-800">{card.age_days} days</dd>
            {card.sections.length > 0 && (
              <>
                <dt className="text-slate-500">Asana section</dt>
                <dd className="flex gap-1 flex-wrap">
                  {card.sections.map(s => <SectionTag key={s} s={s} />)}
                </dd>
              </>
            )}
          </dl>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <a
              href={`/tasks?id=${card.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 underline"
            >
              Open in task board ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EplOperationsPanel() {
  const [board, setBoard] = useState<OpsBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [selectedCard, setSelectedCard] = useState<OpsCard | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (search = '') => {
    try {
      const url = search
        ? `/api/epl/operations?q=${encodeURIComponent(search)}`
        : '/api/epl/operations'
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
    return <div className="p-8 text-sm text-slate-500">Loading Operations board…</div>
  }
  if (error && !board) {
    return <div className="p-8 text-sm text-rose-600">Operations board unavailable: {error}</div>
  }
  if (!board) return null

  return (
    <div className="p-5 max-w-[1400px] mx-auto h-full flex flex-col gap-4">
      {/* Header */}
      <header className="flex items-baseline gap-3 flex-wrap shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">⚙️ Operations</h1>
        <span className="text-xs text-slate-400">
          {board.total_active} active · {board.total_done} total done
        </span>
        {board.generated_at && (
          <span className="text-xs text-slate-300">as of {new Date(board.generated_at).toLocaleTimeString()}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search tasks…"
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none w-52"
          />
          <button
            onClick={() => load(q)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800 transition"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {board.columns.map(col => (
          <div key={col.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{col.label}</div>
            <div className={`mt-0.5 text-2xl font-semibold ${
              col.id === 'in_progress' ? 'text-yellow-700'
              : col.id === 'requests' ? 'text-blue-700'
              : col.id === 'done' ? 'text-emerald-700'
              : 'text-slate-700'
            }`}>{col.cards.length}</div>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        {board.columns.map(col => (
          <Column key={col.id} col={col} onCard={setSelectedCard} />
        ))}
      </div>

      {selectedCard && (
        <TaskDrawer card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  )
}
