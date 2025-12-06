import { Hono } from 'hono'
import type { Env } from '../types'
import { all, one, run } from '../db'

// Roles: supervisor, manager, lead, staff
function assertRole(user: { id: string }, role: string) {
  return async (env: Env, teamId: string) => {
    const m = await one<{ role: string }>(env, 'SELECT role FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1', teamId, user.id)
    if (!m) return false
    const order = ['staff','lead','manager','supervisor']
    return order.indexOf(m.role) >= order.indexOf(role)
  }
}

export const admin = new Hono<{ Bindings: Env }>()

// List team members with roles
admin.get('/teams/:teamId/members', async c => {
  const user = c.get('user') as { id: string }
  const teamId = c.req.param('teamId')
  const can = await assertRole(user, 'lead')(c.env, teamId)
  if (!can) return c.json({ error: 'Forbidden' }, 403)
  const rows = await all(c.env, 'SELECT user_id, role FROM team_members WHERE team_id = ?', teamId)
  return c.json({ members: rows })
})

// Remove member (manager+)
admin.delete('/teams/:teamId/members/:userId', async c => {
  const user = c.get('user') as { id: string }
  const teamId = c.req.param('teamId')
  const targetUserId = c.req.param('userId')
  const can = await assertRole(user, 'manager')(c.env, teamId)
  if (!can) return c.json({ error: 'Forbidden' }, 403)
  await run(c.env, 'DELETE FROM team_members WHERE team_id = ? AND user_id = ?', teamId, targetUserId)
  return c.json({ ok: true })
})

// List team projects (lead+)
admin.get('/teams/:teamId/projects', async c => {
  const user = c.get('user') as { id: string }
  const teamId = c.req.param('teamId')
  const can = await assertRole(user, 'lead')(c.env, teamId)
  if (!can) return c.json({ error: 'Forbidden' }, 403)
  const rows = await all(c.env, 'SELECT id, name, archived, created_at FROM projects WHERE team_id = ? ORDER BY created_at DESC', teamId)
  return c.json({ projects: rows })
})

// Set member role (manager+)
admin.post('/teams/:teamId/members/:userId/role', async c => {
  const user = c.get('user') as { id: string }
  const teamId = c.req.param('teamId')
  const targetUserId = c.req.param('userId')
  const can = await assertRole(user, 'manager')(c.env, teamId)
  if (!can) return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({})) as { role?: 'staff'|'lead'|'manager'|'supervisor' }
  if (!body.role) return c.json({ error: 'role required' }, 400)
  await run(c.env, 'UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?', body.role, teamId, targetUserId)
  return c.json({ ok: true })
})

// Team-wide settings (supervisor-only)
admin.post('/teams/:teamId/settings', async c => {
  const user = c.get('user') as { id: string }
  const teamId = c.req.param('teamId')
  const can = await assertRole(user, 'supervisor')(c.env, teamId)
  if (!can) return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  await run(c.env, 'UPDATE teams SET settings = ? WHERE id = ?', JSON.stringify(body), teamId)
  return c.json({ ok: true })
})

// Manage projects (lead+)
admin.post('/projects/:projectId/archive', async c => {
  const user = c.get('user') as { id: string }
  const projectId = c.req.param('projectId')
  const proj = await one<{ team_id: string }>(c.env, 'SELECT team_id FROM projects WHERE id = ?', projectId)
  if (!proj) return c.json({ error: 'Not found' }, 404)
  const can = await assertRole(user, 'lead')(c.env, proj.team_id)
  if (!can) return c.json({ error: 'Forbidden' }, 403)
  await run(c.env, 'UPDATE projects SET archived = 1 WHERE id = ?', projectId)
  return c.json({ archived: true })
})

admin.post('/projects/:projectId/unarchive', async c => {
  const user = c.get('user') as { id: string }
  const projectId = c.req.param('projectId')
  const proj = await one<{ team_id: string }>(c.env, 'SELECT team_id FROM projects WHERE id = ?', projectId)
  if (!proj) return c.json({ error: 'Not found' }, 404)
  const can = await assertRole(user, 'lead')(c.env, proj.team_id)
  if (!can) return c.json({ error: 'Forbidden' }, 403)
  await run(c.env, 'UPDATE projects SET archived = 0 WHERE id = ?', projectId)
  return c.json({ archived: false })
})
