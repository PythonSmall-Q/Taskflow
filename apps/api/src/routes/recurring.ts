import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const recurring = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// List recurring tasks
recurring.get('/', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const projectId = c.req.query('projectId')
  
  let sql = `SELECT r.*, p.name as project_name
             FROM recurring_tasks r
             JOIN projects p ON r.project_id = p.id
             JOIN team_members m ON m.team_id = p.team_id
             WHERE m.user_id = ?`
  const params: any[] = [user.sub]
  
  if (projectId) { sql += ' AND r.project_id = ?'; params.push(projectId) }
  
  sql += ' ORDER BY r.next_run_at ASC'
  
  const rows = await all(c.env, sql, ...params)
  
  return c.json({
    recurringTasks: rows.map((r: any) => ({
      ...r,
      recurrence_rule: JSON.parse(r.recurrence_rule || '{}'),
      template_config: JSON.parse(r.template_config || '{}')
    }))
  })
})

// Create recurring task
recurring.post('/', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { projectId, title, description, labels, priority, estimateMinutes, recurrenceRule, templateConfig } = body
  
  if (!projectId || !title || !recurrenceRule) {
    return c.json({ error: 'projectId, title, and recurrenceRule required' }, 400)
  }
  
  const id = crypto.randomUUID()
  const nextRunAt = calculateNextRun(recurrenceRule, Date.now())
  
  await run(
    c.env,
    `INSERT INTO recurring_tasks (id, project_id, title, description, labels, priority, estimate_minutes, recurrence_rule, template_config, next_run_at, enabled, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    projectId,
    title,
    description || '',
    labels ? JSON.stringify(labels) : null,
    priority || 'medium',
    estimateMinutes || null,
    JSON.stringify(recurrenceRule),
    JSON.stringify(templateConfig || {}),
    nextRunAt,
    user.sub,
    Date.now()
  )
  
  return c.json({ recurringTask: { id } }, 201)
})

// Update recurring task
recurring.patch('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  const body = await c.req.json()
  const updates: string[] = []
  const values: any[] = []
  
  if (body.title) { updates.push('title = ?'); values.push(body.title) }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
  if (body.priority) { updates.push('priority = ?'); values.push(body.priority) }
  if (body.enabled !== undefined) { updates.push('enabled = ?'); values.push(body.enabled ? 1 : 0) }
  if (body.recurrenceRule) { 
    updates.push('recurrence_rule = ?'); 
    values.push(JSON.stringify(body.recurrenceRule))
    // Recalculate next run when rule changes
    const nextRunAt = calculateNextRun(body.recurrenceRule, Date.now())
    updates.push('next_run_at = ?')
    values.push(nextRunAt)
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  await run(
    c.env,
    `UPDATE recurring_tasks SET ${updates.join(', ')} WHERE id = ?`,
    ...values,
    id
  )
  
  return c.json({ ok: true })
})

// Delete recurring task
recurring.delete('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  await run(c.env, 'DELETE FROM recurring_tasks WHERE id = ?', id)
  return c.json({ ok: true })
})

// Process recurring tasks (called by scheduled trigger)
recurring.post('/process', async c => {
  const now = Date.now()
  
  const tasks = await all(
    c.env,
    `SELECT * FROM recurring_tasks WHERE enabled = 1 AND next_run_at <= ? LIMIT 100`,
    now
  )
  
  let processed = 0
  
  for (const rt of tasks as any[]) {
    // Create the actual task
    const taskId = crypto.randomUUID()
    const key = await c.env.CACHE.get('task-counter')
    let num = key ? parseInt(key, 10) : 0
    num += 1
    await c.env.CACHE.put('task-counter', String(num))
    const taskKey = `TASK-${num.toString().padStart(4, '0')}`
    
    const config = JSON.parse(rt.template_config || '{}')
    
    await run(
      c.env,
      `INSERT INTO tasks (id, project_id, title, description, labels, priority, due_date, estimate_minutes, status, key, rank, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?)`,
      taskId,
      rt.project_id,
      rt.title,
      rt.description,
      rt.labels,
      rt.priority,
      null,
      rt.estimate_minutes,
      taskKey,
      Date.now(),
      Date.now()
    )
    
    // Update recurring task with next run time
    const recurrenceRule = JSON.parse(rt.recurrence_rule)
    const nextRunAt = calculateNextRun(recurrenceRule, now)
    
    await run(
      c.env,
      `UPDATE recurring_tasks SET last_run_at = ?, next_run_at = ? WHERE id = ?`,
      now,
      nextRunAt,
      rt.id
    )
    
    processed++
  }
  
  return c.json({ processed, timestamp: now })
})

// Calculate next run time based on recurrence rule
function calculateNextRun(rule: any, fromTime: number): number {
  const { frequency, interval = 1, daysOfWeek } = rule
  const date = new Date(fromTime)
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + (7 * interval))
      if (daysOfWeek && Array.isArray(daysOfWeek)) {
        // Adjust to next occurrence of specified day
        while (!daysOfWeek.includes(date.getDay())) {
          date.setDate(date.getDate() + 1)
        }
      }
      break
    case 'monthly':
      date.setMonth(date.getMonth() + interval)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval)
      break
    default:
      date.setDate(date.getDate() + 1)
  }
  
  return date.getTime()
}

export default recurring
