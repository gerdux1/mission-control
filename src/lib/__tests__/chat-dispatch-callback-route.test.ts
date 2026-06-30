import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Admin auth always passes; workspace 1.
const requireRoleMock = vi.fn(() => ({ user: { username: 'atlas', workspace_id: 1, role: 'admin' } }))
const broadcastMock = vi.fn()

vi.mock('@/lib/auth', () => ({ requireRole: requireRoleMock }))
vi.mock('@/lib/event-bus', () => ({ eventBus: { broadcast: broadcastMock } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

// In-memory message capture so we can assert what writeReply persisted.
const inserted: Array<Record<string, unknown>> = []
let nextId = 100

const prepareMock = vi.fn((sql: string) => {
  if (sql.includes('INSERT INTO messages')) {
    return {
      run: (...args: unknown[]) => {
        const [conversation_id, from_agent, to_agent, content, message_type, metadata, workspace_id] = args
        inserted.push({
          id: ++nextId,
          conversation_id,
          from_agent,
          to_agent,
          content,
          message_type,
          metadata,
          workspace_id,
        })
        return { lastInsertRowid: nextId }
      },
    }
  }
  if (sql.includes('SELECT * FROM messages WHERE id = ?')) {
    return {
      get: (id: number) => inserted.find((m) => m.id === id),
    }
  }
  throw new Error(`Unexpected SQL in test: ${sql}`)
})

vi.mock('@/lib/db', () => ({
  getDatabase: vi.fn(() => ({ prepare: prepareMock })),
}))

function callbackRequest(query: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/chat/dispatch-callback?${query}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('PATCH /api/chat/dispatch-callback — progress status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inserted.length = 0
    nextId = 100
  })

  it('writes a transient status message for status=progress and broadcasts it', async () => {
    const { PATCH } = await import('@/app/api/chat/dispatch-callback/route')
    const res = await PATCH(
      callbackRequest('conv=agent_atlas&agent=atlas&msg=5', {
        status: 'progress',
        note: '⚙️ Edit · step 3',
        dispatch_id: 77,
      }),
    )

    expect(res.status).toBe(200)
    expect(inserted).toHaveLength(1)
    const msg = inserted[0]
    expect(msg.message_type).toBe('status')
    expect(msg.content).toBe('⚙️ Edit · step 3')
    expect(msg.conversation_id).toBe('agent_atlas')
    expect(JSON.parse(msg.metadata as string)).toMatchObject({ status: 'progress', dispatchId: 77 })

    // Broadcast over SSE so the open thread renders it live.
    expect(broadcastMock).toHaveBeenCalledTimes(1)
    expect(broadcastMock).toHaveBeenCalledWith(
      'chat.message',
      expect.objectContaining({ message_type: 'status', content: '⚙️ Edit · step 3' }),
    )
  })

  it('truncates over-long progress notes to 280 chars', async () => {
    const { PATCH } = await import('@/app/api/chat/dispatch-callback/route')
    const long = 'x'.repeat(500)
    await PATCH(callbackRequest('conv=agent_atlas&agent=atlas', { status: 'progress', note: long }))
    expect((inserted[0].content as string).length).toBe(280)
  })

  it('is a quiet ack (no write) when status=progress carries no note', async () => {
    const { PATCH } = await import('@/app/api/chat/dispatch-callback/route')
    const res = await PATCH(callbackRequest('conv=agent_atlas&agent=atlas', { status: 'progress' }))
    expect(res.status).toBe(200)
    expect(inserted).toHaveLength(0)
    expect(broadcastMock).not.toHaveBeenCalled()
  })

  it('still rejects an unknown status with 400 (regression)', async () => {
    const { PATCH } = await import('@/app/api/chat/dispatch-callback/route')
    const res = await PATCH(callbackRequest('conv=agent_atlas&agent=atlas', { status: 'wat' }))
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('still writes the final reply as text for status=done (regression)', async () => {
    const { PATCH } = await import('@/app/api/chat/dispatch-callback/route')
    await PATCH(
      callbackRequest('conv=agent_atlas&agent=atlas', {
        status: 'done',
        outcome: 'All set.',
        cost_usd: 0.12,
      }),
    )
    expect(inserted[0].message_type).toBe('text')
    expect(inserted[0].content).toContain('All set.')
  })
})
