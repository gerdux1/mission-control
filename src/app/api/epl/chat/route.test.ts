import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'

// Chat POST (send → Atlas /dispatch, 202) + GET poll (read reply from the Atlas
// export). Flag default OFF → 404, proving the interactive chat is inert in prod.

const FLAG = 'COCKPIT_CHAT_ENABLED'
const COCKPIT = 'ATLAS_COCKPIT_PATH'
const DISPATCH_URL = 'ATLAS_DISPATCH_URL'
const DISPATCH_KEY = 'ATLAS_DISPATCH_KEY'

function postReq(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/epl/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
    body: body ? JSON.stringify(body) : undefined,
  })
}
function getReq(): NextRequest {
  return new NextRequest('http://localhost/api/epl/chat/x', { headers: { 'x-api-key': 'test' } })
}

describe('POST /api/epl/chat — gated dispatch', () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of [FLAG, DISPATCH_URL, DISPATCH_KEY]) saved[k] = process.env[k]
    vi.resetModules()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    for (const k of [FLAG, DISPATCH_URL, DISPATCH_KEY]) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]!
    }
    vi.restoreAllMocks()
  })

  async function loadPost() {
    vi.doMock('@/lib/auth', () => ({
      requireRole: vi.fn(() => ({ user: { id: 7, role: 'operator', username: 'gerda' } })),
    }))
    vi.doMock('@/lib/rate-limit', () => ({ mutationLimiter: vi.fn(() => null) }))
    return (await import('./route')).POST
  }

  it('404s when COCKPIT_CHAT_ENABLED is OFF (inert in prod)', async () => {
    delete process.env[FLAG]
    const POST = await loadPost()
    const res = await POST(postReq({ agent: 'atlas', message: 'hi' }) as any)
    expect(res.status).toBe(404)
  })

  it('forwards a turn to Atlas /dispatch with a thread_id and returns 202', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ dispatch_id: 'd1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const POST = await loadPost()
    const res = await POST(postReq({ agent: 'James', message: 'June margin?' }) as any)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('accepted')
    expect(typeof body.thread_id).toBe('string')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://atlas.test:18790/dispatch')
    const sent = JSON.parse((init as any).body)
    expect(sent.agent).toBe('james') // lowercased
    expect(sent.kind).toBe('chat') // Atlas /dispatch reads `kind`, not `mode`
    expect(sent.thread_id).toBe(body.thread_id)
    expect(sent.prompt).toBe('June margin?')
  })

  it('reuses a provided thread_id', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const POST = await loadPost()
    const res = await POST(postReq({ agent: 'atlas', thread_id: 'chat-keep', message: 'next' }) as any)
    const body = await res.json()
    expect(body.thread_id).toBe('chat-keep')
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).thread_id).toBe('chat-keep')
  })

  it('400s on a missing message before any Atlas call', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const POST = await loadPost()
    const res = await POST(postReq({ agent: 'atlas' }) as any)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces an Atlas rejection (does not claim accepted)', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'agent busy' }), { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    const POST = await loadPost()
    const res = await POST(postReq({ agent: 'atlas', message: 'hi' }) as any)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('agent busy')
  })
})

describe('GET /api/epl/chat/[thread_id] — poll', () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of [FLAG, COCKPIT]) saved[k] = process.env[k]
    vi.resetModules()
  })
  afterEach(() => {
    for (const k of [FLAG, COCKPIT]) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]!
    }
  })

  const params = (id: string) => ({ params: Promise.resolve({ thread_id: id }) })

  async function writeCockpit(conversations: unknown[]): Promise<string> {
    const tmp = path.join(os.tmpdir(), `mc-chat-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
    await fs.writeFile(tmp, JSON.stringify({ generated_at: '2026-06-23T10:00:00Z', conversations }), 'utf-8')
    return tmp
  }

  it('404s when the flag is OFF', async () => {
    delete process.env[FLAG]
    const { GET } = await import('./[thread_id]/route')
    const res = await GET(getReq() as any, params('chat-1'))
    expect(res.status).toBe(404)
  })

  it("returns 'pending' when the thread isn't in the export yet (never 500)", async () => {
    process.env[FLAG] = '1'
    process.env[COCKPIT] = path.join(os.tmpdir(), `mc-chat-none-${Date.now()}.json`)
    const { GET } = await import('./[thread_id]/route')
    const res = await GET(getReq() as any, params('chat-unknown'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('pending')
  })

  it('returns the reply + per-turn cost when the turn is done', async () => {
    process.env[FLAG] = '1'
    const tmp = await writeCockpit([
      { id: 'chat-1', agent: 'james', cost_usd: 0.12, turns: 1, last_ts: '2026-06-23T10:00:00Z', title: 'q', status: 'done', reply: 'June margin was 31%.' },
    ])
    process.env[COCKPIT] = tmp
    try {
      const { GET } = await import('./[thread_id]/route')
      const res = await GET(getReq() as any, params('chat-1'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('done')
      expect(body.reply).toBe('June margin was 31%.')
      expect(body.cost_usd).toBe(0.12)
    } finally {
      await fs.rm(tmp, { force: true })
    }
  })

  it('reports awaiting_approval for an action-triggering turn (routes to Panel 5)', async () => {
    process.env[FLAG] = '1'
    const tmp = await writeCockpit([
      { id: 'chat-2', agent: 'victoria', cost_usd: 0.05, turns: 1, last_ts: '2026-06-23T10:00:00Z', title: 'send', awaiting_approval: true },
    ])
    process.env[COCKPIT] = tmp
    try {
      const { GET } = await import('./[thread_id]/route')
      const res = await GET(getReq() as any, params('chat-2'))
      const body = await res.json()
      expect(body.status).toBe('awaiting_approval')
      expect(body.awaiting_approval).toBe(true)
    } finally {
      await fs.rm(tmp, { force: true })
    }
  })
})
