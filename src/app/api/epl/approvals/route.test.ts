import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'

// The GET (list) + POST (resolve) routes read the flag + Atlas config at call
// time, so we toggle env per-test. The flag default is OFF → 404, proving the
// surface is inert unless explicitly armed.

const FLAG = 'COCKPIT_APPROVALS_ENABLED'
const COCKPIT = 'ATLAS_COCKPIT_PATH'
const DISPATCH_URL = 'ATLAS_DISPATCH_URL'
const DISPATCH_KEY = 'ATLAS_DISPATCH_KEY'

function makeReq(method = 'GET', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/epl/approvals', {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/epl/approvals — gated list', () => {
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

  it('404s when COCKPIT_APPROVALS_ENABLED is OFF (inert in prod)', async () => {
    delete process.env[FLAG]
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    expect(res.status).toBe(404)
  })

  it('lists pending_approvals[] from the Atlas export when ON', async () => {
    process.env[FLAG] = '1'
    const tmp = path.join(os.tmpdir(), `mc-approvals-${Date.now()}.json`)
    await fs.writeFile(
      tmp,
      JSON.stringify({
        generated_at: '2026-06-23T10:00:00Z',
        pending_approvals: [
          { id: 'run-42', agent: 'victoria', kind: 'send_email', summary: 'Returning-guest offer', requested_at: '2026-06-23T09:00:00Z', cost_cap_usd: 0.5, impact: 'high', reversible: false },
          { id: '', agent: 'x', summary: 'dropped — no id' },
        ],
      }),
      'utf-8',
    )
    process.env[COCKPIT] = tmp
    try {
      const { GET } = await import('./route')
      const res = await GET(makeReq())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.source).toBe('live')
      expect(body.pending_count).toBe(1) // id-less row dropped by the reader
      expect(body.pending[0].id).toBe('run-42')
      expect(body.pending[0].reversible).toBe(false)
    } finally {
      await fs.rm(tmp, { force: true })
    }
  })

  it('returns an honest empty list (never 500) when the export is missing', async () => {
    process.env[FLAG] = 'on'
    process.env[COCKPIT] = path.join(os.tmpdir(), `mc-approvals-missing-${Date.now()}.json`)
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.source).toBe('empty')
    expect(body.pending).toEqual([])
  })
})

describe('POST /api/epl/approvals/[id] — resolve via Atlas', () => {
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
    const audit = vi.fn()
    vi.doMock('@/lib/db', () => ({ logAuditEvent: audit }))
    const mod = await import('./[id]/route')
    return { POST: mod.POST, audit }
  }

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('404s when the flag is OFF — no Atlas call possible', async () => {
    delete process.env[FLAG]
    const { POST } = await loadPost()
    const res = await POST(makeReq('POST', { decision: 'approve' }) as any, params('run-42'))
    expect(res.status).toBe(404)
  })

  it('forwards an approve to Atlas /dispatch/approve and writes an audit row', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ released: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { POST, audit } = await loadPost()
    const res = await POST(makeReq('POST', { decision: 'approve' }) as any, params('run-42'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.decision).toBe('approve')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://atlas.test:18790/dispatch/approve')
    expect((init as any).headers['X-Dispatch-Key']).toBe('shh')
    expect(JSON.parse((init as any).body)).toMatchObject({ id: 'run-42', decision: 'approve', actor: 'gerda' })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'cockpit_approval_resolved', detail: expect.objectContaining({ decision: 'approve' }) }))
  })

  it('forwards a reject', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ killed: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await loadPost()
    const res = await POST(makeReq('POST', { decision: 'reject' }) as any, params('run-99'))
    expect(res.status).toBe(200)
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body).decision).toBe('reject')
  })

  it('rejects an invalid decision (400) before any Atlas call', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await loadPost()
    const res = await POST(makeReq('POST', { decision: 'maybe' }) as any, params('run-42'))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces an Atlas rejection without claiming success', async () => {
    process.env[FLAG] = '1'
    process.env[DISPATCH_URL] = 'http://atlas.test:18790'
    process.env[DISPATCH_KEY] = 'shh'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'already resolved' }), { status: 409 }))
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await loadPost()
    const res = await POST(makeReq('POST', { decision: 'approve' }) as any, params('run-42'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('already resolved')
  })

  it('503s when dispatch is not configured', async () => {
    process.env[FLAG] = '1'
    delete process.env[DISPATCH_URL]
    delete process.env[DISPATCH_KEY]
    const { POST } = await loadPost()
    const res = await POST(makeReq('POST', { decision: 'approve' }) as any, params('run-42'))
    expect(res.status).toBe(503)
  })
})
