import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const templates = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// List task templates
templates.get('/', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const teamId = c.req.query('teamId')
  if (!teamId) return c.json({ error: 'teamId required' }, 400)
  
  const rows = await all(
    c.env,
    `SELECT t.*, u.name as created_by_name
     FROM task_templates t
     LEFT JOIN users u ON t.created_by = u.id
     JOIN team_members m ON m.team_id = t.team_id
     WHERE t.team_id = ? AND m.user_id = ?
     ORDER BY t.created_at DESC`,
    teamId,
    user.sub
  )
  
  return c.json({ 
    templates: rows.map((t: any) => ({
      ...t,
      config: JSON.parse(t.config || '{}')
    }))
  })
})

// Get single template
templates.get('/:id', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  const template = await one<any>(
    c.env,
    `SELECT t.*, u.name as created_by_name
     FROM task_templates t
     LEFT JOIN users u ON t.created_by = u.id
     JOIN team_members m ON m.team_id = t.team_id
     WHERE t.id = ? AND m.user_id = ?
     LIMIT 1`,
    id,
    user.sub
  )
  
  if (!template) return c.json({ error: 'Template not found' }, 404)
  
  return c.json({ 
    template: {
      ...template,
      config: JSON.parse(template.config || '{}')
    }
  })
})

// Create template
templates.post('/', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { teamId, name, description, config } = body
  
  if (!teamId || !name || !config) {
    return c.json({ error: 'teamId, name, and config required' }, 400)
  }
  
  const id = crypto.randomUUID()
  await run(
    c.env,
    `INSERT INTO task_templates (id, team_id, name, description, config, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    teamId,
    name,
    description || '',
    JSON.stringify(config),
    user.sub,
    Date.now()
  )
  
  return c.json({ template: { id, name } }, 201)
})

// Update template
templates.patch('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  const body = await c.req.json()
  const { name, description, config } = body
  
  const updates: string[] = []
  const values: any[] = []
  
  if (name) { updates.push('name = ?'); values.push(name) }
  if (description !== undefined) { updates.push('description = ?'); values.push(description) }
  if (config) { updates.push('config = ?'); values.push(JSON.stringify(config)) }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  await run(
    c.env,
    `UPDATE task_templates SET ${updates.join(', ')} WHERE id = ?`,
    ...values,
    id
  )
  
  return c.json({ ok: true })
})

// Delete template
templates.delete('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  await run(c.env, 'DELETE FROM task_templates WHERE id = ?', id)
  return c.json({ ok: true })
})

export default templates
