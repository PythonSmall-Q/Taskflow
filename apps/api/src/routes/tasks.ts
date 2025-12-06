import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, TaskStatus } from '../types'
import { all, one, run } from '../db'
import { requireScope } from '../middleware'
import { getBearer, verifyJWT } from '../utils'
import type { Env } from '../types'

export const tasks = new Hono<{ Bindings: Env }>()

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
  const body = await c.req.json().catch(() => ({})) as { description?: string }
  if (typeof body.description === 'string') {
    await run(c.env, 'UPDATE tasks SET description = ? WHERE id = ?', body.description, id)
    await fireAutomationsByTaskId(c.env, id, 'task.updated', { description: true })
  }
  return c.json({ ok: true })
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
