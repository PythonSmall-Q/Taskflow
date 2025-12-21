import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const timeTracking = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// Start time tracking for a task
timeTracking.post('/start', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { taskId, description } = body
  
  if (!taskId) return c.json({ error: 'taskId required' }, 400)
  
  // Check if there's already an active timer
  const activeTimer = await one<any>(
    c.env,
    `SELECT * FROM time_entries WHERE user_id = ? AND end_time IS NULL LIMIT 1`,
    user.sub
  )
  
  if (activeTimer) {
    return c.json({ error: 'Stop the current timer first', activeTimer }, 400)
  }
  
  const id = crypto.randomUUID()
  await run(
    c.env,
    `INSERT INTO time_entries (id, task_id, user_id, start_time, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    taskId,
    user.sub,
    Date.now(),
    description || '',
    Date.now()
  )
  
  return c.json({ timeEntry: { id, taskId, startTime: Date.now() } }, 201)
})

// Stop time tracking
timeTracking.post('/stop', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { id } = body
  
  const entry = await one<any>(
    c.env,
    `SELECT * FROM time_entries WHERE id = ? AND user_id = ? LIMIT 1`,
    id,
    user.sub
  )
  
  if (!entry) return c.json({ error: 'Time entry not found' }, 404)
  if (entry.end_time) return c.json({ error: 'Timer already stopped' }, 400)
  
  const endTime = Date.now()
  const duration = Math.floor((endTime - entry.start_time) / 1000) // seconds
  
  await run(
    c.env,
    `UPDATE time_entries SET end_time = ?, duration_seconds = ? WHERE id = ?`,
    endTime,
    duration,
    id
  )
  
  return c.json({ 
    timeEntry: { 
      id, 
      duration: duration,
      startTime: entry.start_time,
      endTime 
    } 
  })
})

// Get active timer for current user
timeTracking.get('/active', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const entry = await one<any>(
    c.env,
    `SELECT te.*, t.title as task_title, t.key as task_key, p.name as project_name
     FROM time_entries te
     JOIN tasks t ON te.task_id = t.id
     JOIN projects p ON t.project_id = p.id
     WHERE te.user_id = ? AND te.end_time IS NULL
     LIMIT 1`,
    user.sub
  )
  
  if (!entry) return c.json({ timeEntry: null })
  
  return c.json({ 
    timeEntry: {
      ...entry,
      elapsed: Math.floor((Date.now() - entry.start_time) / 1000)
    }
  })
})

// Get time entries for a task
timeTracking.get('/task/:taskId', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const taskId = c.req.param('taskId')
  
  const entries = await all(
    c.env,
    `SELECT te.*, u.name as user_name, u.avatar_url
     FROM time_entries te
     LEFT JOIN users u ON te.user_id = u.id
     WHERE te.task_id = ?
     ORDER BY te.start_time DESC`,
    taskId
  )
  
  const total = await one<any>(
    c.env,
    `SELECT SUM(duration_seconds) as total_seconds
     FROM time_entries
     WHERE task_id = ? AND duration_seconds IS NOT NULL`,
    taskId
  )
  
  return c.json({ 
    entries,
    totalSeconds: total?.total_seconds || 0,
    totalHours: Math.round((total?.total_seconds || 0) / 3600 * 100) / 100
  })
})

// Get time entries for a user (with date range)
timeTracking.get('/user/:userId', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const userId = c.req.param('userId')
  const from = parseInt(c.req.query('from') || '0', 10)
  const to = parseInt(c.req.query('to') || String(Date.now()), 10)
  
  const entries = await all(
    c.env,
    `SELECT te.*, t.title as task_title, t.key as task_key, p.name as project_name, p.id as project_id
     FROM time_entries te
     JOIN tasks t ON te.task_id = t.id
     JOIN projects p ON t.project_id = p.id
     WHERE te.user_id = ? AND te.start_time >= ? AND te.start_time <= ?
     ORDER BY te.start_time DESC`,
    userId,
    from,
    to
  )
  
  const total = await one<any>(
    c.env,
    `SELECT SUM(duration_seconds) as total_seconds
     FROM time_entries
     WHERE user_id = ? AND start_time >= ? AND start_time <= ? AND duration_seconds IS NOT NULL`,
    userId,
    from,
    to
  )
  
  return c.json({ 
    entries,
    totalSeconds: total?.total_seconds || 0,
    totalHours: Math.round((total?.total_seconds || 0) / 3600 * 100) / 100
  })
})

// Get time summary by project
timeTracking.get('/summary/project/:projectId', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  const from = parseInt(c.req.query('from') || '0', 10)
  const to = parseInt(c.req.query('to') || String(Date.now()), 10)
  
  const taskSummary = await all(
    c.env,
    `SELECT 
       t.id,
       t.title,
       t.key,
       COUNT(te.id) as entry_count,
       SUM(te.duration_seconds) as total_seconds
     FROM tasks t
     LEFT JOIN time_entries te ON t.id = te.task_id 
       AND te.start_time >= ? AND te.start_time <= ?
     WHERE t.project_id = ?
     GROUP BY t.id
     ORDER BY total_seconds DESC`,
    from,
    to,
    projectId
  )
  
  const userSummary = await all(
    c.env,
    `SELECT 
       u.id,
       u.name,
       u.avatar_url,
       COUNT(te.id) as entry_count,
       SUM(te.duration_seconds) as total_seconds
     FROM users u
     LEFT JOIN time_entries te ON u.id = te.user_id
     JOIN tasks t ON te.task_id = t.id
     WHERE t.project_id = ? AND te.start_time >= ? AND te.start_time <= ?
     GROUP BY u.id
     ORDER BY total_seconds DESC`,
    projectId,
    from,
    to
  )
  
  return c.json({
    taskSummary: taskSummary.map((t: any) => ({
      ...t,
      total_hours: Math.round((t.total_seconds || 0) / 3600 * 100) / 100
    })),
    userSummary: userSummary.map((u: any) => ({
      ...u,
      total_hours: Math.round((u.total_seconds || 0) / 3600 * 100) / 100
    }))
  })
})

// Update time entry (edit description or manual time)
timeTracking.patch('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  const body = await c.req.json()
  const { description, startTime, endTime } = body
  
  const updates: string[] = []
  const values: any[] = []
  
  if (description !== undefined) { updates.push('description = ?'); values.push(description) }
  if (startTime) { updates.push('start_time = ?'); values.push(startTime) }
  if (endTime) { 
    updates.push('end_time = ?'); 
    values.push(endTime)
    // Recalculate duration if both times exist
    if (startTime || updates.some(u => u.includes('start_time'))) {
      const entry = await one<any>(c.env, 'SELECT start_time FROM time_entries WHERE id = ?', id)
      const start = startTime || entry?.start_time
      if (start) {
        const duration = Math.floor((endTime - start) / 1000)
        updates.push('duration_seconds = ?')
        values.push(duration)
      }
    }
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  await run(
    c.env,
    `UPDATE time_entries SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
    ...values,
    id,
    user.sub
  )
  
  return c.json({ ok: true })
})

// Delete time entry
timeTracking.delete('/:id', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  await run(c.env, 'DELETE FROM time_entries WHERE id = ? AND user_id = ?', id, user.sub)
  return c.json({ ok: true })
})

export default timeTracking
