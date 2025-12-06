import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, JWTPayload, Role } from '../types'
import { all, one, run } from '../db'
import { getBearer, verifyJWT } from '../utils'

export const teams = new Hono<{ Bindings: Env }>()

const teamSchema = z.object({ name: z.string().min(1) })

async function authUser(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try {
    return await verifyJWT(token, c.env.JWT_SECRET)
  } catch {
    return null
  }
}

teams.get('/', async c => {
  const user = await authUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const rows = await all<{ id: string; name: string; role: Role }>(
    c.env,
    `SELECT t.id, t.name, m.role
     FROM team_members m JOIN teams t ON m.team_id = t.id
     WHERE m.user_id = ?`,
    user.sub
  )
  return c.json({ teams: rows })
})

teams.post('/', async c => {
  const user = await authUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const parsed = teamSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

  const id = crypto.randomUUID()
  await run(c.env, 'INSERT INTO teams (id, name, created_at) VALUES (?, ?, ?)', id, parsed.data.name, Date.now())
  await run(c.env, 'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)', id, user.sub, 'owner')
  return c.json({ team: { id, name: parsed.data.name, role: 'owner' } })
})

teams.post('/:id/invite', async c => {
  const user = await authUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const teamId = c.req.param('id')
  const member = await one<{ role: Role }>(
    c.env,
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
    teamId,
    user.sub
  )
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) return c.json({ error: 'Forbidden' }, 403)
  const token = crypto.randomUUID()
  await run(c.env, 'INSERT INTO invites (id, team_id, created_by, created_at) VALUES (?, ?, ?, ?)', token, teamId, user.sub, Date.now())
  return c.json({ invite: { token, teamId } })
})

teams.post('/join/:token', async c => {
  const user = await authUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const token = c.req.param('token')
  const invite = await one<{ team_id: string }>(c.env, 'SELECT team_id FROM invites WHERE id = ? LIMIT 1', token)
  if (!invite) return c.json({ error: 'Invalid invite' }, 400)
  await run(c.env, 'INSERT OR IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)', invite.team_id, user.sub, 'member')
  return c.json({ ok: true, teamId: invite.team_id })
})
