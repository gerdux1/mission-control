import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, db_helpers } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/briefings/generate - Generate daily briefing for an agent
 * Body: { agent_name: string, date?: string }
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const db = getDatabase();
    const body = await request.json();
    const workspaceId = auth.user.workspace_id ?? 1;

    const agentName = body.agent_name;
    const targetDate = body.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (!agentName) {
      return NextResponse.json({ error: 'agent_name is required' }, { status: 400 });
    }

    // Get agent info
    const agent = db.prepare('SELECT * FROM agents WHERE name = ? AND workspace_id = ?').get(agentName, workspaceId) as any;
    if (!agent) {
      return NextResponse.json({ error: `Agent ${agentName} not found` }, { status: 404 });
    }

    // Get urgency items (urgent/high priority tasks due today or overdue)
    const urgentTasks = db.prepare(`
      SELECT id, title, priority, due_date, status, description
      FROM tasks
      WHERE assigned_to = ?
      AND workspace_id = ?
      AND status NOT IN ('done')
      AND (priority IN ('urgent', 'high') OR (due_date IS NOT NULL AND due_date < ?))
      ORDER BY priority DESC, due_date ASC
      LIMIT 10
    `).all(agentName, workspaceId, Math.floor(Date.now() / 1000)) as any[];

    // Get calendar items (from task due dates for today/tomorrow)
    const startOfDay = Math.floor(new Date(`${targetDate}T00:00:00Z`).getTime() / 1000);
    const endOfDay = Math.floor(new Date(`${targetDate}T23:59:59Z`).getTime() / 1000);
    const startOfTomorrow = endOfDay + 1;
    const tomorrowDate = new Date(new Date(targetDate).getTime() + 86400000).toISOString().split('T')[0];
    const endOfTomorrow = Math.floor(new Date(`${tomorrowDate}T23:59:59Z`).getTime() / 1000);

    const todayTasks = db.prepare(`
      SELECT id, title, status, priority, due_date
      FROM tasks
      WHERE assigned_to = ?
      AND workspace_id = ?
      AND status NOT IN ('done')
      AND due_date BETWEEN ? AND ?
      ORDER BY due_date ASC
    `).all(agentName, workspaceId, startOfDay, endOfDay) as any[];

    const tomorrowTasks = db.prepare(`
      SELECT id, title, status, priority, due_date
      FROM tasks
      WHERE assigned_to = ?
      AND workspace_id = ?
      AND status NOT IN ('done')
      AND due_date BETWEEN ? AND ?
      ORDER BY due_date ASC
    `).all(agentName, workspaceId, startOfTomorrow, endOfTomorrow) as any[];

    // Get task counts for metrics
    const inProgressCount = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND workspace_id = ? AND status = 'in_progress'
    `).get(agentName, workspaceId) as { count: number };

    const assignedCount = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND workspace_id = ? AND status = 'assigned'
    `).get(agentName, workspaceId) as { count: number };

    const reviewCount = db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND workspace_id = ? AND status IN ('review', 'quality_review')
    `).get(agentName, workspaceId) as { count: number };

    const completedToday = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE assigned_to = ? AND workspace_id = ? AND status = 'done' AND updated_at BETWEEN ? AND ?
    `).get(agentName, workspaceId, startOfDay, endOfDay) as { count: number };

    // Generate briefing content
    const briefingContent = generateBriefing({
      agentName,
      date: targetDate,
      urgentTasks,
      todayTasks,
      tomorrowTasks,
      metrics: {
        inProgress: inProgressCount.count,
        assigned: assignedCount.count,
        review: reviewCount.count,
        completedToday: completedToday.count
      }
    });

    // Store briefing
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT OR REPLACE INTO briefings
      (agent_name, date, content, urgency_items, calendar_items, metrics, created_at, updated_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agentName,
      targetDate,
      briefingContent.content,
      JSON.stringify(urgentTasks.slice(0, 5)),
      JSON.stringify([
        ...todayTasks.map(t => ({ ...t, period: 'today' })),
        ...tomorrowTasks.map(t => ({ ...t, period: 'tomorrow' }))
      ]),
      JSON.stringify(briefingContent.metrics),
      now,
      now,
      workspaceId
    );

    // Log activity
    db_helpers.logActivity(
      'briefing_generated',
      'briefing',
      0,
      auth.user.username,
      `Generated briefing for ${agentName} on ${targetDate}`,
      {
        agentName,
        date: targetDate,
        urgentItemsCount: urgentTasks.length,
        todayTasksCount: todayTasks.length
      },
      workspaceId
    );

    return NextResponse.json({
      briefing: {
        agent: agentName,
        date: targetDate,
        content: briefingContent.content,
        urgency_items: urgentTasks.slice(0, 5),
        calendar_items: { today: todayTasks, tomorrow: tomorrowTasks },
        metrics: briefingContent.metrics
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'POST /api/briefings/generate error');
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 });
  }
}

/**
 * GET /api/briefings - Get briefings history
 * Query: agent_name?, date?, limit?, offset?
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    const workspaceId = auth.user.workspace_id ?? 1;

    const agentName = searchParams.get('agent_name');
    const date = searchParams.get('date');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = 'SELECT * FROM briefings WHERE workspace_id = ?';
    const params: any[] = [workspaceId];

    if (agentName) {
      query += ' AND agent_name = ?';
      params.push(agentName);
    }
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }

    query += ' ORDER BY date DESC, agent_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const briefings = db.prepare(query).all(...params) as any[];

    const countQuery = 'SELECT COUNT(*) as total FROM briefings WHERE workspace_id = ?' +
      (agentName ? ' AND agent_name = ?' : '') +
      (date ? ' AND date = ?' : '');
    const countParams: any[] = [workspaceId];
    if (agentName) countParams.push(agentName);
    if (date) countParams.push(date);

    const countResult = db.prepare(countQuery).get(...countParams) as { total: number };

    return NextResponse.json({
      briefings: briefings.map(b => ({
        id: b.id,
        agent_name: b.agent_name,
        date: b.date,
        content: b.content,
        urgency_items: b.urgency_items ? JSON.parse(b.urgency_items) : [],
        calendar_items: b.calendar_items ? JSON.parse(b.calendar_items) : [],
        metrics: b.metrics ? JSON.parse(b.metrics) : {},
        posted_at: b.posted_at,
        created_at: b.created_at
      })),
      total: countResult.total,
      page: Math.floor(offset / limit) + 1,
      limit
    });
  } catch (error) {
    logger.error({ err: error }, 'GET /api/briefings error');
    return NextResponse.json({ error: 'Failed to fetch briefings' }, { status: 500 });
  }
}

/**
 * Generate markdown briefing content
 */
function generateBriefing(params: {
  agentName: string;
  date: string;
  urgentTasks: any[];
  todayTasks: any[];
  tomorrowTasks: any[];
  metrics: { inProgress: number; assigned: number; review: number; completedToday: number };
}) {
  const { agentName, date, urgentTasks, todayTasks, tomorrowTasks, metrics } = params;

  let content = `# Morning Briefing — ${agentName} — ${date}\n\n`;

  if (urgentTasks.length > 0) {
    content += `## 🔴 URGENT — Do These First\n\n`;
    urgentTasks.slice(0, 5).forEach((task, idx) => {
      content += `**${idx + 1}. ${task.title}**\n`;
      if (task.description) {
        content += `${task.description.substring(0, 150)}...\n`;
      }
      content += `\n`;
    });
  }

  if (todayTasks.length > 0 || tomorrowTasks.length > 0) {
    content += `## 📅 Your Calendar\n\n`;
    if (todayTasks.length > 0) {
      content += `### Today\n`;
      todayTasks.forEach(task => {
        content += `- ${task.title}\n`;
      });
      content += `\n`;
    }
    if (tomorrowTasks.length > 0) {
      content += `### Tomorrow (preview)\n`;
      tomorrowTasks.forEach(task => {
        content += `- ${task.title}\n`;
      });
      content += `\n`;
    }
  }

  content += `## 📊 Your Status\n\n`;
  content += `- **In Progress**: ${metrics.inProgress} tasks\n`;
  content += `- **Assigned**: ${metrics.assigned} tasks waiting\n`;
  content += `- **In Review**: ${metrics.review} tasks\n`;
  content += `- **Completed Today**: ${metrics.completedToday} tasks\n`;

  return {
    content,
    metrics
  };
}
