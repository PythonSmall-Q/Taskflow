import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types'
import { all, one, run } from '../db'
import { getBearer, verifyJWT } from '../utils'

export const projects = new Hono<{ Bindings: Env }>()

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

projects.post('/', async c => {
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
