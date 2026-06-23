'use client'

/**
 * EPL Agent Cockpit — Chat (Phase 2 SCAFFOLD, gated OFF).
 *
 * ⚠️ SCAFFOLD ONLY. Static placeholder. The interactive cockpit chat must NOT
 * be deployed live this phase — there is intentionally NO send handler, NO
 * dispatch, NO network call. Registered only when `cockpitChatEnabled()` is true
 * (default OFF). Even when reached, the composer is disabled.
 *
 * Phase-2 plan (NOT built here): wire the composer to the existing dispatch /
 * chat transport behind auth + a cost cap. Do not add a send handler to this
 * file without the Phase-2 sign-off.
 */

import { cockpitChatEnabled } from '@/lib/cockpit-flags'

const MOCK_THREAD = [
  { from: 'gerda', text: 'Atlas, what shipped this week across the fleet?' },
  { from: 'atlas', text: '(scaffold) Phase-2 chat will answer here via the dispatch transport.' },
]

export function EplChatPanel() {
  const enabled = cockpitChatEnabled()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 flex flex-col h-full">
      <header className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">💬 Cockpit chat</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/30">Phase 2 · scaffold</span>
      </header>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <strong>Not wired — disabled.</strong> The interactive chat is not deployed live this phase. No send handler, no dispatch.
        Flag <code>COCKPIT_CHAT_ENABLED</code> is currently <strong>{enabled ? 'ON (preview only)' : 'OFF'}</strong>.
      </div>

      <section className="flex-1 space-y-3 overflow-y-auto">
        {MOCK_THREAD.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'gerda' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.from === 'gerda' ? 'bg-blue-600/30 text-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              <div className="text-[11px] text-muted-foreground capitalize mb-0.5">{m.from}</div>
              {m.text}
            </div>
          </div>
        ))}
      </section>

      <div className="flex gap-2 items-center border-t border-border pt-3">
        <input
          disabled
          placeholder="Chat is disabled in this phase (scaffold only)"
          className="flex-1 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
        />
        <button disabled className="px-4 py-2 rounded-xl bg-blue-600/40 text-white text-sm cursor-not-allowed" title="Phase 2 — not wired">Send</button>
      </div>
    </div>
  )
}
