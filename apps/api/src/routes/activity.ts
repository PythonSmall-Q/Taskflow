import { Hono } from 'hono'
import { all, run } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const activity = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// Get activity log for a team
activity.get('/', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const teamId = c.req.query('teamId')
  const entityType = c.req.query('entityType')
  const entityId = c.req.query('entityId')
  const limit = parseInt(c.req.query('limit') || '50', 10)
  const offset = parseInt(c.req.query('offset') || '0', 10)
  
  let sql = `SELECT a.*, u.name as user_name, u.avatar_url as user_avatar
             FROM activity_log a
             LEFT JOIN users u ON a.user_id = u.id
             JOIN team_members m ON m.team_id = a.team_id
             WHERE m.user_id = ?`
  const params: any[] = [user.sub]
  
  if (teamId) { sql += ' AND a.team_id = ?'; params.push(teamId) }
  if (entityType) { sql += ' AND a.entity_type = ?'; params.push(entityType) }
  if (entityId) { sql += ' AND a.entity_id = ?'; params.push(entityId) }
  
  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const rows = await all(c.env, sql, ...params)
  
  return c.json({ 
    activities: rows.map((a: any) => ({
      ...a,
      changes: a.changes ? JSON.parse(a.changes) : null
    })),
    limit,
    offset
  })
})

// Log an activity
export async function logActivity(
  env: Env,
  teamId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: any
) {
  const id = crypto.randomUUID()
  await run(
    env,
    `INSERT INTO activity_log (id, team_id, user_id, action, entity_type, entity_id, changes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    teamId,
    userId,
    action,
    entityType,
    entityId,
    changes ? JSON.stringify(changes) : null,
    Date.now()
  )
}

export default activity
