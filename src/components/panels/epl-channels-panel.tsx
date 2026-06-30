'use client'

/**
 * EPL Channels — fleet Slack activity mirrored into MC.
 *
 * Read-only mirror of each agent's Slack channel (recent messages, input +
 * output) so Gerda can see what the fleet is doing without hopping between
 * channels. Fed by /api/epl/channels (a scheduled reader pushes the messages,
 * because MC's bot is Slack write-only). Honest empty state until first push.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

interface ChannelMsg { ts: string; author: string; text: string }
interface ChannelMirror {
  key: string
  agent: string
  channelName: string
  channelId?: string
  messages: ChannelMsg[]
  updatedAt: string
}
interface ChannelsData {
  source: 'stored' | 'empty' | 'error'
  updatedAt: string | null
  channels: ChannelMirror[]
  note?: string
}

const AGENT_EMOJI: Record<string, string> = {
  Sofia: '📨', Hugo: '🔧', Iris: '⭐', James: '💰', Leo: '📣', Aria: '💡',
  Larry: '🤝', Owen: '🔬', Atlas: '🧭', Cleo: '💵',
}

function fmtTime(ts: string): string {
  // Slack ts like "1782806910.630219" (epoch seconds) or an ISO string.
  const n = Number(ts)
  const d = Number.isFinite(n) && n > 1_000_000_000 ? new Date(n * 1000) : new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function EplChannelsPanel() {
  const [data, setData] = useState<ChannelsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<string>('all')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/epl/channels', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    if (!data) return []
    return active === 'all' ? data.channels : data.channels.filter(c => c.key === active)
  }, [data, active])

  if (error) return <div className="p-8 text-rose-700">Failed: {error}</div>
  if (!data) return <div className="p-8 text-sm text-slate-500">Loading channels…</div>

  const empty = data.source !== 'stored' || data.channels.length === 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <header className="space-y-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-semibold tracking-tight">💬 Channels</h1>
          <span className="text-slate-500 text-sm">{data.channels.length} agent channel{data.channels.length === 1 ? '' : 's'} mirrored</span>
          <button onClick={load} className="ml-auto text-xs underline text-slate-500 hover:text-slate-700">refresh</button>
        </div>
        <p className="text-slate-700 text-sm">Fleet Slack activity in one place — each agent's channel input + output, mirrored from Slack.</p>
        <div className={`text-xs rounded-xl border px-3 py-2 ${empty ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {empty
            ? '⚠ No channels mirrored yet — the channels-mirror reader has not pushed any messages.'
            : `Live mirror · updated ${data.updatedAt ? new Date(data.updatedAt).toLocaleString('en-GB') : 'unknown'}.`}
        </div>
      </header>

      {!empty && (
        <>
          {/* Agent filter */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActive('all')} className={`px-3 py-1 rounded-full text-xs border ${active === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>All</button>
            {data.channels.map(c => (
              <button key={c.key} onClick={() => setActive(c.key)} className={`px-3 py-1 rounded-full text-xs border ${active === c.key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                {AGENT_EMOJI[c.agent] ?? '🤖'} {c.agent}
              </button>
            ))}
          </div>

          {visible.map(c => (
            <section key={c.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="text-lg">{AGENT_EMOJI[c.agent] ?? '🤖'}</span>
                <span className="font-medium text-slate-900">{c.agent}</span>
                <span className="text-xs text-slate-500">{c.channelName}</span>
                <span className="ml-auto text-xs text-slate-400">{c.messages.length} recent</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
                {c.messages.length === 0 && <div className="px-4 py-3 text-xs text-slate-400 italic">no recent messages</div>}
                {c.messages.map((m, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-800">{m.author}</span>
                      <span className="text-xs text-slate-400">{fmtTime(m.ts)}</span>
                    </div>
                    <pre className="text-sm text-slate-700 mt-1 whitespace-pre-wrap font-sans leading-relaxed">{m.text}</pre>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <footer className="text-xs text-slate-400 pt-4 border-t border-slate-100">
        Source: <code>/api/epl/channels</code> ← channels-mirror reader (Slack → MC). Read-only.
      </footer>
    </div>
  )
}
