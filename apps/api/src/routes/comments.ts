import { Hono } from 'hono'
import type { AppContext } from '../types'
import { getBearer, verifyJWT } from '../utils'
import { run, one, all } from '../db'
import { requireScope } from '../middleware'
import { broadcastToHooks } from './integrations'

export const comments = new Hono<AppContext>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

comments.post('/', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const form = await c.req.parseBody()
  const taskId = String(form['taskId'] || '')
  const body = String(form['body'] || '')
  if (!taskId || !body) return c.json({ error: 'Missing taskId/body' }, 400)

  const task = await one<{ project_id: string }>(c.env, 'SELECT project_id FROM tasks WHERE id = ? LIMIT 1', taskId)
  if (!task) return c.json({ error: 'Task not found' }, 404)

  // Save attachments to R2
  const files: string[] = []
  const inputs = Array.isArray(form['files']) ? form['files'] : (form['files'] ? [form['files']] : [])
  for (const f of inputs as File[]) {
    const key = `${user.sub}/${taskId}/${Date.now()}-${f.name}`
    await c.env.FILES.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } })
    files.push(key)
  }

  const id = crypto.randomUUID()
  await run(c.env, 'INSERT INTO comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)', id, taskId, user.sub, body, Date.now())

  // Mentions: parse @email or @userId
  const mentions = Array.from(body.matchAll(/@([\w.\-+@]+)/g)).map(m => m[1])
  if (mentions.length) {
    const team = await one<{ team_id: string }>(c.env, 'SELECT p.team_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ? LIMIT 1', taskId)
    if (team) {
      const members = await all<{ user_id: string; email?: string }>(c.env, 'SELECT m.user_id, u.email FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = ?', team.team_id)
      const notifyUsers = members.filter(m => mentions.includes(m.email || '') || mentions.includes(m.user_id))
      for (const u2 of notifyUsers) {
        await run(c.env, 'INSERT INTO notifications (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), u2.user_id, 'mention', JSON.stringify({ taskId, commentId: id }), Date.now())
      }
      // Broadcast to Slack/Discord
      await broadcastToHooks(c.env, team.team_id, `New comment mention on task ${taskId}: ${body.slice(0, 120)}`)
    }
  }

  // Realtime broadcast via Durable Object (room id: project_id)
  const stub = c.env.ROOM_DO.idFromName(task.project_id)
  const obj = c.env.ROOM_DO.get(stub)
  await obj.fetch('http://do/broadcast', { method: 'POST', body: JSON.stringify({ type: 'comment.created', taskId, commentId: id }) })

  return c.json({ comment: { id, taskId, body, files } }, 201)
})

comments.get('/task/:taskId', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const taskId = c.req.param('taskId')
  const rows = await all<{ id: string; user_id: string; body: string; created_at: number }>(c.env, 'SELECT id, user_id, body, created_at FROM comments WHERE task_id = ? ORDER BY created_at DESC', taskId)
  return c.json({ comments: rows })
})
