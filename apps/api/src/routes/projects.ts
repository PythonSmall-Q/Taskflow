import { Hono } from 'hono'
import { z } from 'zod'
import type { AppContext } from '../types'
import { all, one, run } from '../db'
import { requireScope } from '../middleware'
import { getBearer, verifyJWT } from '../utils'

export const projects = new Hono<AppContext>()

const schema = z.object({ name: z.string().min(1), description: z.string().optional(), color: z.string().optional() })

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

projects.get('/', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const rows = await all(
    c.env,
    `SELECT p.* FROM projects p
     JOIN team_members m ON p.team_id = m.team_id
     WHERE m.user_id = ? AND p.archived = 0
     ORDER BY p.created_at DESC`,
    user.sub
  )
  return c.json({ projects: rows })
})

projects.post('/', requireScope('projects:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

  // Use the first team the user belongs to for MVP
  const team = await one<{ team_id: string }>(c.env, 'SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1', user.sub)
  if (!team) return c.json({ error: 'Join or create a team first' }, 400)

  const id = crypto.randomUUID()
  await run(
    c.env,
    'INSERT INTO projects (id, team_id, name, description, color, created_at, archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
    id,
    team.team_id,
    parsed.data.name,
    parsed.data.description ?? '',
    parsed.data.color ?? '#7c3aed',
    Date.now()
  )
  return c.json({ project: { id, ...parsed.data } }, 201)
})

// Get project statistics
projects.get('/:id/stats', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('id')
  
  // Task counts by status
  const tasksByStatus = await all(
    c.env,
    `SELECT status, COUNT(*) as count
     FROM tasks
     WHERE project_id = ?
     GROUP BY status`,
    projectId
  )
  
  // Task counts by priority
  const tasksByPriority = await all(
    c.env,
    `SELECT priority, COUNT(*) as count
     FROM tasks
     WHERE project_id = ?
     GROUP BY priority`,
    projectId
  )
  
  // Overdue tasks
  const overdueTasks = await one<any>(
    c.env,
    `SELECT COUNT(*) as count
     FROM tasks
     WHERE project_id = ? AND due_date < ? AND status != 'done'`,
    projectId,
    Date.now()
  )
  
  // Total estimate vs completed
  const estimates = await one<any>(
    c.env,
    `SELECT 
       SUM(CASE WHEN status = 'done' THEN estimate_minutes ELSE 0 END) as completed_minutes,
       SUM(estimate_minutes) as total_minutes
     FROM tasks
     WHERE project_id = ?`,
    projectId
  )
  
  // Task completion rate over last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  const recentActivity = await all(
    c.env,
    `SELECT 
       date(created_at / 1000, 'unixepoch') as day,
       COUNT(*) as created,
       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
     FROM tasks
     WHERE project_id = ? AND created_at >= ?
     GROUP BY day
     ORDER BY day ASC`,
    projectId,
    thirtyDaysAgo
  )
  
  // Top contributors (by task creation and comments)
  const contributors = await all(
    c.env,
    `SELECT 
       u.id,
       u.name,
       u.avatar_url,
       COUNT(DISTINCT t.id) as tasks_assigned,
       COUNT(DISTINCT c.id) as comments_made
     FROM users u
     LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = ?
     LEFT JOIN comments c ON c.user_id = u.id
     LEFT JOIN tasks t2 ON c.task_id = t2.id AND t2.project_id = ?
     GROUP BY u.id
     HAVING tasks_assigned > 0 OR comments_made > 0
     ORDER BY (tasks_assigned + comments_made) DESC
     LIMIT 10`,
    projectId,
    projectId
  )
  
  return c.json({
    stats: {
      tasksByStatus,
      tasksByPriority,
      overdueTasks: overdueTasks?.count || 0,
      estimates: {
        completed: estimates?.completed_minutes || 0,
        total: estimates?.total_minutes || 0,
        percentage: estimates?.total_minutes > 0 
          ? Math.round((estimates.completed_minutes / estimates.total_minutes) * 100)
          : 0
      },
      recentActivity,
      contributors
    }
  })
})

// Duplicate project
projects.post('/:id/duplicate', requireScope('projects:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('id')
  
  const project = await one<any>(
    c.env,
    `SELECT p.* FROM projects p
     JOIN team_members m ON p.team_id = m.team_id
     WHERE p.id = ? AND m.user_id = ?
     LIMIT 1`,
    projectId,
    user.sub
  )
  
  if (!project) return c.json({ error: 'Project not found' }, 404)
  
  const newId = crypto.randomUUID()
  await run(
    c.env,
    `INSERT INTO projects (id, team_id, name, description, color, created_at, archived)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    newId,
    project.team_id,
    project.name + ' (Copy)',
    project.description,
    project.color,
    Date.now()
  )
  
  return c.json({ project: { id: newId, name: project.name + ' (Copy)' } }, 201)
})

// Archive/unarchive project
projects.patch('/:id/archive', requireScope('projects:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('id')
  const body = await c.req.json()
  const { archived } = body
  
  await run(
    c.env,
    `UPDATE projects SET archived = ? WHERE id = ?`,
    archived ? 1 : 0,
    projectId
  )
  
  return c.json({ ok: true })
})
