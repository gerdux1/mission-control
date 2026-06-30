import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Regression guard for the 30 Jun 2026 mass-delete: GET /api/tasks must NOT
// silently ignore a `search` filter and return the whole board, and the bulk
// PUT must reject stray query params. See route.ts for the incident note.

const requireRoleMock = vi.fn(() => ({
  user: { username: 'admin', workspace_id: 1, role: 'admin', agent_name: null },
}))
const mutationLimiterMock = vi.fn(() => null)
const requireWorkspaceIdMock = vi.fn(() => ({ workspaceId: 1 }))
const validateBodyMock = vi.fn(async () => ({ data: { tasks: [] } }))
const prepareMock = vi.fn()
const allMock = vi.fn(() => [] as any[])
const getMock = vi.fn(() => ({ total: 0 }))

vi.mock('@/lib/auth', () => ({ requireRole: requireRoleMock }))
vi.mock('@/lib/rate-limit', () => ({ mutationLimiter: mutationLimiterMock }))
vi.mock('@/lib/enforcement/workspace-scope', () => ({
  requireWorkspaceId: requireWorkspaceIdMock,
  requireAgentTaskAccess: vi.fn(() => null),
}))
vi.mock('@/lib/validation', () => ({
  validateBody: validateBodyMock,
  createTaskSchema: {},
  bulkUpdateTaskStatusSchema: {},
}))
vi.mock('@/lib/mentions', () => ({ resolveMentionRecipients: vi.fn(() => ({ recipients: [], unresolved: [] })) }))
vi.mock('@/lib/task-status', () => ({
  normalizeTaskCreateStatus: vi.fn((s: string) => s),
  resolveTaskAssignee: vi.fn((a: string) => a),
}))
vi.mock('@/lib/task-dispatch', () => ({ reconcileDeferredTaskCompletions: vi.fn() }))
vi.mock('@/lib/github-sync-engine', () => ({ pushTaskToGitHub: vi.fn(), syncTaskOutbound: vi.fn() }))
vi.mock('@/lib/gnap-sync', () => ({ pushTaskToGnap: vi.fn(), removeTaskFromGnap: vi.fn() }))
vi.mock('@/lib/config', () => ({ config: { coordinatorAgent: '', gnap: { enabled: false, autoSync: false, repoPath: '' } } }))
vi.mock('@/lib/event-bus', () => ({ eventBus: { broadcast: vi.fn() } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/db', () => ({
  getDatabase: vi.fn(() => ({ prepare: prepareMock })),
  db_helpers: { logActivity: vi.fn(), ensureTaskSubscription: vi.fn(), createNotification: vi.fn() },
}))

describe('GET /api/tasks search filter + param guard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireRoleMock.mockReturnValue({ user: { username: 'admin', workspace_id: 1, role: 'admin', agent_name: null } })
    requireWorkspaceIdMock.mockReturnValue({ workspaceId: 1 })
    allMock.mockReturnValue([])
    getMock.mockReturnValue({ total: 0 })
    prepareMock.mockImplementation((sql: string) => {
      // Note: the list query embeds a `(SELECT COUNT(*) FROM comments ...)`
      // subquery, so match the count query by its distinct `COUNT(*) as total`.
      if (sql.includes('COUNT(*) as total')) return { get: getMock }
      return { all: allMock, get: getMock }
    })
  })

  it('applies search as a real WHERE filter — a non-matching search affects 0 rows, not the whole board', async () => {
    const { GET } = await import('@/app/api/tasks/route')
    const request = new NextRequest('http://localhost/api/tasks?search=nomatch')

    const response = await GET(request)
    const body = await response.json() as { tasks: unknown[]; total: number }

    expect(response.status).toBe(200)
    // The main list query must carry the search predicate + the two LIKE params.
    const listCall = prepareMock.mock.calls.find(([sql]) => String(sql).includes('FROM tasks t'))
    expect(listCall?.[0]).toContain('t.title LIKE ?')
    const likeArgs = allMock.mock.calls[0] as unknown[]
    expect(likeArgs).toContain('%nomatch%')
    // No matching rows -> empty result, NOT every task.
    expect(body.tasks).toEqual([])
    expect(body.total).toBe(0)
  })

  it('escapes LIKE wildcards so a literal % does not widen the match', async () => {
    const { GET } = await import('@/app/api/tasks/route')
    const request = new NextRequest('http://localhost/api/tasks?search=50%25')

    await GET(request)
    const likeArgs = allMock.mock.calls[0] as unknown[]
    expect(likeArgs).toContain('%50\\%%')
  })

  it('rejects an unsupported query param with 400 instead of silently returning everything', async () => {
    const { GET } = await import('@/app/api/tasks/route')
    const request = new NextRequest('http://localhost/api/tasks?q=anything')

    const response = await GET(request)
    const body = await response.json() as { error: string; unknown_params: string[] }

    expect(response.status).toBe(400)
    expect(body.unknown_params).toContain('q')
    expect(allMock).not.toHaveBeenCalled()
  })
})

describe('PUT /api/tasks bulk update param guard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireRoleMock.mockReturnValue({ user: { username: 'admin', workspace_id: 1, role: 'operator', agent_name: null } })
    requireWorkspaceIdMock.mockReturnValue({ workspaceId: 1 })
    validateBodyMock.mockResolvedValue({ data: { tasks: [] } })
  })

  it('rejects a destructive bulk call carrying a stray ?search= with 400', async () => {
    const { PUT } = await import('@/app/api/tasks/route')
    const request = new NextRequest('http://localhost/api/tasks?search=nomatch', {
      method: 'PUT',
      body: JSON.stringify({ tasks: [{ id: 1, status: 'done' }] }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PUT(request)
    const body = await response.json() as { error: string; unknown_params: string[] }

    expect(response.status).toBe(400)
    expect(body.unknown_params).toContain('search')
    // Body validation/mutation must not run once the guard rejects.
    expect(validateBodyMock).not.toHaveBeenCalled()
  })
})
