import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, TaskStatus } from '../types'
import { all, one, run } from '../db'
import { requireScope } from '../middleware'
import { getBearer, verifyJWT } from '../utils'
import type { AppContext } from '../types'

export const tasks = new Hono<AppContext>()

const upsert = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  labels: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.number().optional(),
  estimateMinutes: z.number().int().nonnegative().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).default('todo')
})

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

tasks.get('/:projectId', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  const rows = await all(
    c.env,
    `SELECT t.* FROM tasks t
     JOIN projects p ON t.project_id = p.id
     JOIN team_members m ON m.team_id = p.team_id
     WHERE p.id = ? AND m.user_id = ?
     ORDER BY t.rank ASC, t.created_at DESC`,
    projectId,
    user.sub
  )
  return c.json({ tasks: rows })
})

tasks.post('/', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const parsed = upsert.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

  const id = crypto.randomUUID()
  const key = await c.env.CACHE.get('task-counter')
  let num = key ? parseInt(key, 10) : 0
  num += 1
  await c.env.CACHE.put('task-counter', String(num))
  const taskKey = `TASK-${num.toString().padStart(4, '0')}`

  await run(
    c.env,
    `INSERT INTO tasks (id, project_id, title, description, labels, priority, due_date, estimate_minutes, status, key, rank, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    parsed.data.projectId,
    parsed.data.title,
    parsed.data.description ?? '',
    JSON.stringify(parsed.data.labels ?? []),
    parsed.data.priority,
    parsed.data.dueDate ?? null,
    parsed.data.estimateMinutes ?? null,
    parsed.data.status,
    taskKey,
    Date.now(),
    Date.now()
  )

  // Fire automations for task created
  await fireAutomations(c.env, parsed.data.projectId, 'task.created', { id, key: taskKey, title: parsed.data.title })
  return c.json({ task: { id, key: taskKey, ...parsed.data } }, 201)
})

const moveSchema = z.object({ id: z.string().uuid(), status: z.enum(['todo', 'in_progress', 'review', 'done']), rank: z.number().int() })

tasks.post('/move', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const parsed = moveSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)
  await run(c.env, 'UPDATE tasks SET status = ?, rank = ? WHERE id = ?', parsed.data.status, parsed.data.rank, parsed.data.id)
  // Fire automations for status change
  await fireAutomationsByTaskId(c.env, parsed.data.id, 'task.status_changed', { status: parsed.data.status })
  return c.json({ ok: true })
})

// Update task (e.g., description)
tasks.patch('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as { 
    description?: string
    title?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    due_date?: number
    labels?: string[]
  }
  
  const updates: string[] = []
  const values: any[] = []
  
  if (typeof body.description === 'string') {
    updates.push('description = ?')
    values.push(body.description)
  }
  if (typeof body.title === 'string') {
    updates.push('title = ?')
    values.push(body.title)
  }
  if (body.priority) {
    updates.push('priority = ?')
    values.push(body.priority)
  }
  if (body.due_date !== undefined) {
    updates.push('due_date = ?')
    values.push(body.due_date)
  }
  if (Array.isArray(body.labels)) {
    updates.push('labels = ?')
    values.push(JSON.stringify(body.labels))
  }
  
  if (updates.length > 0) {
    values.push(id)
    await run(c.env, `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, ...values)
    await fireAutomationsByTaskId(c.env, id, 'task.updated', body)
  }
  return c.json({ ok: true })
})

// Delete task
tasks.delete('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  await run(c.env, 'DELETE FROM tasks WHERE id = ?', id)
  return c.json({ ok: true })
})

// Bulk operations
tasks.post('/bulk', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const { operation, taskIds } = body as { operation: 'delete' | 'move' | 'update', taskIds: string[], status?: string, updates?: any }
  
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return c.json({ error: 'taskIds must be a non-empty array' }, 400)
  }
  
  const placeholders = taskIds.map(() => '?').join(',')
  
  if (operation === 'delete') {
    await run(c.env, `DELETE FROM tasks WHERE id IN (${placeholders})`, ...taskIds)
    return c.json({ ok: true, deleted: taskIds.length })
  }
  
  if (operation === 'move' && body.status) {
    await run(c.env, `UPDATE tasks SET status = ? WHERE id IN (${placeholders})`, body.status, ...taskIds)
    return c.json({ ok: true, updated: taskIds.length })
  }
  
  if (operation === 'update' && body.updates) {
    const updates: string[] = []
    const values: any[] = []
    if (body.updates.priority) { updates.push('priority = ?'); values.push(body.updates.priority) }
    if (body.updates.due_date !== undefined) { updates.push('due_date = ?'); values.push(body.updates.due_date) }
    if (updates.length > 0) {
      await run(c.env, `UPDATE tasks SET ${updates.join(', ')} WHERE id IN (${placeholders})`, ...values, ...taskIds)
      return c.json({ ok: true, updated: taskIds.length })
    }
  }
  
  return c.json({ error: 'Invalid operation' }, 400)
})

// Duplicate task
tasks.post('/:id/duplicate', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  const task = await one<any>(c.env, 'SELECT * FROM tasks WHERE id = ? LIMIT 1', id)
  if (!task) return c.json({ error: 'Task not found' }, 404)
  
  const newId = crypto.randomUUID()
  const key = await c.env.CACHE.get('task-counter')
  let num = key ? parseInt(key, 10) : 0
  num += 1
  await c.env.CACHE.put('task-counter', String(num))
  const taskKey = `TASK-${num.toString().padStart(4, '0')}`
  
  await run(
    c.env,
    `INSERT INTO tasks (id, project_id, title, description, labels, priority, due_date, estimate_minutes, status, key, rank, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId,
    task.project_id,
    task.title + ' (Copy)',
    task.description,
    task.labels,
    task.priority,
    null, // Reset due date
    task.estimate_minutes,
    'todo', // Reset to todo
    taskKey,
    Date.now(),
    Date.now()
  )
  
  return c.json({ task: { id: newId, key: taskKey } }, 201)
})

// Create task from template
tasks.post('/from-template/:templateId', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const templateId = c.req.param('templateId')
  const body = await c.req.json()
  const { projectId } = body
  
  if (!projectId) return c.json({ error: 'projectId required' }, 400)
  
  const template = await one<any>(c.env, 'SELECT * FROM task_templates WHERE id = ? LIMIT 1', templateId)
  if (!template) return c.json({ error: 'Template not found' }, 404)
  
  const id = crypto.randomUUID()
  const key = await c.env.CACHE.get('task-counter')
  let num = key ? parseInt(key, 10) : 0
  num += 1
  await c.env.CACHE.put('task-counter', String(num))
  const taskKey = `TASK-${num.toString().padStart(4, '0')}`
  
  const config = JSON.parse(template.config || '{}')
  await run(
    c.env,
    `INSERT INTO tasks (id, project_id, title, description, labels, priority, due_date, estimate_minutes, status, key, rank, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    projectId,
    config.title || 'New Task',
    config.description || '',
    JSON.stringify(config.labels || []),
    config.priority || 'medium',
    null,
    config.estimate_minutes || null,
    'todo',
    taskKey,
    Date.now(),
    Date.now()
  )
  
  return c.json({ task: { id, key: taskKey } }, 201)
})

// Export tasks
tasks.get('/:projectId/export', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  const format = c.req.query('format') || 'json'
  
  const rows = await all(
    c.env,
    `SELECT t.* FROM tasks t
     JOIN projects p ON t.project_id = p.id
     JOIN team_members m ON m.team_id = p.team_id
     WHERE p.id = ? AND m.user_id = ?
     ORDER BY t.created_at DESC`,
    projectId,
    user.sub
  )
  
  if (format === 'csv') {
    const headers = ['Key', 'Title', 'Status', 'Priority', 'Due Date', 'Created At']
    const csvRows = rows.map((t: any) => [
      t.key,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority || '',
      t.due_date ? new Date(t.due_date).toISOString() : '',
      new Date(t.created_at).toISOString()
    ])
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n')
    return new Response(csv, { headers: { 'content-type': 'text/csv', 'content-disposition': `attachment; filename="tasks-${projectId}.csv"` } })
  }
  
  return c.json({ tasks: rows, exported_at: new Date().toISOString() })
})

// Search tasks with advanced filters
tasks.post('/search', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const { query, projectId, status, priority, labels, assigneeId, dueBefore, dueAfter } = body
  
  let sql = `SELECT t.* FROM tasks t
             JOIN projects p ON t.project_id = p.id
             JOIN team_members m ON m.team_id = p.team_id
             WHERE m.user_id = ?`
  const params: any[] = [user.sub]
  
  if (projectId) { sql += ' AND t.project_id = ?'; params.push(projectId) }
  if (status) { sql += ' AND t.status = ?'; params.push(status) }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority) }
  if (assigneeId) { sql += ' AND t.assignee_id = ?'; params.push(assigneeId) }
  if (dueBefore) { sql += ' AND t.due_date < ?'; params.push(dueBefore) }
  if (dueAfter) { sql += ' AND t.due_date > ?'; params.push(dueAfter) }
  if (query) { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${query}%`, `%${query}%`) }
  
  sql += ' ORDER BY t.created_at DESC LIMIT 100'
  
  const rows = await all(c.env, sql, ...params)
  return c.json({ tasks: rows, count: rows.length })
})

async function fireAutomations(env: Env, projectId: string, trigger: string, payload: any) {
  const proj = await one<{ team_id: string }>(env, 'SELECT team_id FROM projects WHERE id = ? LIMIT 1', projectId)
  if (!proj) return
  const rules = await all<{ id: string; action: string; config: string }>(env, 'SELECT id, action, config FROM automations WHERE team_id = ? AND trigger = ? AND active = 1', proj.team_id, trigger)
  for (const r of rules) {
    const cfg = JSON.parse(r.config || '{}')
    if (r.action === 'webhook.call') await callWebhook(env, proj.team_id, trigger, payload, cfg)
    if (r.action === 'notify.user') await enqueueNotification(env, proj.team_id, payload, cfg)
  }
}

async function fireAutomationsByTaskId(env: Env, taskId: string, trigger: string, payload: any) {
  const proj = await one<{ team_id: string }>(env, 'SELECT p.team_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ? LIMIT 1', taskId)
  if (!proj) return
  const rules = await all<{ id: string; action: string; config: string }>(env, 'SELECT id, action, config FROM automations WHERE team_id = ? AND trigger = ? AND active = 1', proj.team_id, trigger)
  for (const r of rules) {
    const cfg = JSON.parse(r.config || '{}')
    if (r.action === 'webhook.call') await callWebhook(env, proj.team_id, trigger, payload, cfg)
    if (r.action === 'notify.user') await enqueueNotification(env, proj.team_id, payload, cfg)
  }
}

async function callWebhook(env: Env, teamId: string, event: string, payload: any, cfg: any) {
  const hooks = await all<{ url: string; secret: string }>(env, 'SELECT url, secret FROM webhooks WHERE team_id = ? AND active = 1', teamId)
  for (const h of hooks) {
    const body = JSON.stringify({ event, payload, ts: Date.now() })
    let sig = ''
    if (h.secret && h.secret !== '-') {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(h.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
      sig = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
    }
    try {
      const res = await fetch(h.url, { method: 'POST', headers: { 'content-type': 'application/json', ...(sig ? { 'x-taskflow-signature': sig } : {}) }, body })
      if (!res.ok) throw new Error(`Webhook ${h.url} status ${res.status}`)
    } catch (e) {
      // Simple retry once
      try { await fetch(h.url, { method: 'POST', headers: { 'content-type': 'application/json', ...(sig ? { 'x-taskflow-signature': sig } : {}) }, body }) } catch {}
    }
  }
}

async function enqueueNotification(env: Env, teamId: string, payload: any, cfg: any) {
  const users = await all<{ user_id: string }>(env, 'SELECT user_id FROM team_members WHERE team_id = ?', teamId)
  for (const u of users) {
    await run(env, 'INSERT INTO notifications (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), u.user_id, cfg?.type || 'automation', JSON.stringify(payload), Date.now())
  }
    const text = cfg?.text || `Task update: ${JSON.stringify(payload)}`
    const { broadcastToHooks } = await import('./integrations')
    await broadcastToHooks(env, teamId, text)
}
