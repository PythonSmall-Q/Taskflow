import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, TaskStatus } from '../types'
import { all, one, run } from '../db'
import { getBearer, verifyJWT } from '../utils'

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

tasks.post('/', async c => {
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

  return c.json({ task: { id, key: taskKey, ...parsed.data } }, 201)
})

const moveSchema = z.object({ id: z.string().uuid(), status: z.enum(['todo', 'in_progress', 'review', 'done']), rank: z.number().int() })

tasks.post('/move', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const parsed = moveSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)
  await run(c.env, 'UPDATE tasks SET status = ?, rank = ? WHERE id = ?', parsed.data.status, parsed.data.rank, parsed.data.id)
  return c.json({ ok: true })
})
