'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Publish to BOOM — operator UI for POST /api/boom-push.
 * Writes a guest-portal INFO TOPIC to a listing via Atlas's browser-free paster.
 * Standalone page (doesn't touch the board). Topics only.
 */

type Phase = 'idle' | 'sending' | 'done' | 'error'

interface Result {
  ok?: boolean
  posted?: boolean
  verified?: boolean
  skipped?: boolean
  error?: string
  note?: string
  entry_id?: string
}

export default function BoomPublishPage() {
  const [listingId, setListingId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [guests, setGuests] = useState(true)
  const [ai, setAi] = useState(true)
  const [owners, setOwners] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<Result | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setPhase('sending')
    setResult(null)
    try {
      const res = await fetch('/api/boom-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: Number(listingId),
          title,
          body,
          audience: { guests, ai, owners },
        }),
      })
      const data: Result = await res.json().catch(() => ({}))
      setResult(data)
      setPhase(res.ok && data.posted ? 'done' : 'error')
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'request failed' })
      setPhase('error')
    }
  }

  const busy = phase === 'sending'
  const label = (s: string) => <span className="text-sm text-zinc-300">{s}</span>
  const input =
    'w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 ' +
    'placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <h1 className="text-xl font-semibold mb-1">Publish to BOOM</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Write a guest-portal info topic to a listing. No clicking — Atlas writes it
          via BOOM&apos;s API and verifies it. Topics only (not FAQs).
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            {label('BOOM listing ID')}
            <input
              className={input}
              inputMode="numeric"
              placeholder="e.g. 14447"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              required
            />
          </div>
          <div>
            {label('Topic title')}
            <input
              className={input}
              placeholder="e.g. Parking"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            {label('Body (guest-visible text)')}
            <textarea
              className={input + ' min-h-[120px] resize-y'}
              placeholder="e.g. On-street parking is free after 6pm."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={guests} onChange={(e) => setGuests(e.target.checked)} />
              Guests
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />
              AI
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={owners} onChange={(e) => setOwners(e.target.checked)} />
              Owners
            </label>
          </div>

          <Button type="submit" disabled={busy}>
            {busy ? 'Publishing…' : 'Publish to BOOM'}
          </Button>
        </form>

        {result && (
          <div
            className={
              'mt-6 rounded-md border px-4 py-3 text-sm ' +
              (phase === 'done'
                ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
                : 'border-amber-700 bg-amber-950/40 text-amber-200')
            }
          >
            {phase === 'done' ? (
              <>
                ✅ Published{result.verified ? ' and verified' : ' (verification pending)'}
                {result.skipped ? ' — already up to date' : ''}
                {result.entry_id ? ` · item ${result.entry_id}` : ''}
              </>
            ) : (
              <>⚠️ Not published: {result.error || result.note || 'Atlas declined or is not armed'}</>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
