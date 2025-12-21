import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const users = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// Get user profile
users.get('/me', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const profile = await one<any>(
    c.env,
    `SELECT u.id, u.email, u.name, u.avatar_url, u.preferences, u.created_at,
            s.email_notifications, s.theme, s.language, s.timezone
     FROM users u
     LEFT JOIN user_settings s ON u.id = s.user_id
     WHERE u.id = ?
     LIMIT 1`,
    user.sub
  )
  
  if (!profile) return c.json({ error: 'User not found' }, 404)
  
  return c.json({
    user: {
      ...profile,
      preferences: profile.preferences ? JSON.parse(profile.preferences) : {}
    }
  })
})

// Update user profile
users.patch('/me', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { name, avatarUrl, preferences } = body
  
  const updates: string[] = []
  const values: any[] = []
  
  if (name) { updates.push('name = ?'); values.push(name) }
  if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); values.push(avatarUrl) }
  if (preferences) { updates.push('preferences = ?'); values.push(JSON.stringify(preferences)) }
  
  if (updates.length > 0) {
    await run(
      c.env,
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      ...values,
      user.sub
    )
  }
  
  return c.json({ ok: true })
})

// Get user settings
users.get('/me/settings', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const settings = await one<any>(
    c.env,
    `SELECT * FROM user_settings WHERE user_id = ? LIMIT 1`,
    user.sub
  )
  
  if (!settings) {
    // Create default settings
    await run(
      c.env,
      `INSERT INTO user_settings (user_id, email_notifications, theme, language, timezone, updated_at)
       VALUES (?, 1, 'light', 'en', 'UTC', ?)`,
      user.sub,
      Date.now()
    )
    return c.json({
      settings: {
        user_id: user.sub,
        email_notifications: 1,
        theme: 'light',
        language: 'en',
        timezone: 'UTC'
      }
    })
  }
  
  return c.json({ settings })
})

// Update user settings
users.patch('/me/settings', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { emailNotifications, theme, language, timezone } = body
  
  const updates: string[] = ['updated_at = ?']
  const values: any[] = [Date.now()]
  
  if (emailNotifications !== undefined) { 
    updates.push('email_notifications = ?'); 
    values.push(emailNotifications ? 1 : 0) 
  }
  if (theme) { updates.push('theme = ?'); values.push(theme) }
  if (language) { updates.push('language = ?'); values.push(language) }
  if (timezone) { updates.push('timezone = ?'); values.push(timezone) }
  
  // Upsert: try update first, insert if not exists
  const existing = await one(c.env, 'SELECT user_id FROM user_settings WHERE user_id = ? LIMIT 1', user.sub)
  
  if (existing) {
    await run(
      c.env,
      `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
      ...values,
      user.sub
    )
  } else {
    await run(
      c.env,
      `INSERT INTO user_settings (user_id, email_notifications, theme, language, timezone, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      user.sub,
      emailNotifications !== undefined ? (emailNotifications ? 1 : 0) : 1,
      theme || 'light',
      language || 'en',
      timezone || 'UTC',
      Date.now()
    )
  }
  
  return c.json({ ok: true })
})

// Get user statistics
users.get('/me/stats', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  // Get task counts by status
  const taskStats = await all(
    c.env,
    `SELECT t.status, COUNT(*) as count
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     JOIN team_members m ON m.team_id = p.team_id
     WHERE m.user_id = ?
     GROUP BY t.status`,
    user.sub
  )
  
  // Get assigned tasks
  const assignedTasks = await one<any>(
    c.env,
    `SELECT COUNT(*) as count
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     JOIN team_members m ON m.team_id = p.team_id
     WHERE t.assignee_id = ? AND m.user_id = ?`,
    user.sub,
    user.sub
  )
  
  // Get projects count
  const projects = await one<any>(
    c.env,
    `SELECT COUNT(DISTINCT p.id) as count
     FROM projects p
     JOIN team_members m ON m.team_id = p.team_id
     WHERE m.user_id = ? AND p.archived = 0`,
    user.sub
  )
  
  // Get comments count
  const comments = await one<any>(
    c.env,
    `SELECT COUNT(*) as count
     FROM comments c
     WHERE c.user_id = ?`,
    user.sub
  )
  
  return c.json({
    stats: {
      tasksByStatus: taskStats,
      assignedTasks: assignedTasks?.count || 0,
      projects: projects?.count || 0,
      comments: comments?.count || 0
    }
  })
})

export default users
