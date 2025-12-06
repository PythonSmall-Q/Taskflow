import { Hono } from 'hono'
import type { AppContext } from '../types'
import { all, run } from '../db'
import { getBearer, verifyJWT } from '../utils'

export const automation = new Hono<AppContext>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

automation.get('/', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const rules = await all(c.env, `SELECT a.* FROM automations a JOIN team_members m ON a.team_id = m.team_id WHERE m.user_id = ?`, user.sub)
  return c.json({ automations: rules })
})

automation.post('/', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const id = crypto.randomUUID()
  const team = await c.env.DB.prepare('SELECT team_id FROM team_members WHERE user_id = ? LIMIT 1').bind(user.sub).first<{ team_id: string }>()
  if (!team) return c.json({ error: 'Join or create a team first' }, 400)
  await run(c.env, 'INSERT INTO automations (id, team_id, name, trigger, action, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', id, team.team_id, body.name, body.trigger, body.action, JSON.stringify(body.config||{}), Date.now())
  return c.json({ automation: { id, ...body } }, 201)
})
