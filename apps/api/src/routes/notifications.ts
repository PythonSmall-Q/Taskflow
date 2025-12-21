import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const notifications = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// Send email notification
async function sendEmail(env: Env, to: string, subject: string, body: string) {
  // Integration with email service (e.g., Resend, SendGrid, AWS SES)
  // For now, we'll queue it for async processing
  const id = crypto.randomUUID()
  await run(
    env,
    `INSERT INTO email_queue (id, recipient, subject, body, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    id,
    to,
    subject,
    body,
    Date.now()
  )
  return id
}

// Create notification
async function createNotification(
  env: Env,
  userId: string,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string,
  actionUrl?: string
) {
  const id = crypto.randomUUID()
  await run(
    env,
    `INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, action_url, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    userId,
    type,
    title,
    message,
    entityType || null,
    entityId || null,
    actionUrl || null,
    Date.now()
  )
  
  // Check if user has email notifications enabled
  const settings = await one<any>(
    env,
    `SELECT email_notifications FROM user_settings WHERE user_id = ? LIMIT 1`,
    userId
  )
  
  if (settings && settings.email_notifications === 1) {
    const user = await one<any>(env, 'SELECT email FROM users WHERE id = ? LIMIT 1', userId)
    if (user?.email) {
      await sendEmail(env, user.email, title, message)
    }
  }
  
  return id
}

// Get notifications for current user
notifications.get('/', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const limit = parseInt(c.req.query('limit') || '50', 10)
  const offset = parseInt(c.req.query('offset') || '0', 10)
  const unreadOnly = c.req.query('unread') === 'true'
  
  let sql = `SELECT * FROM notifications WHERE user_id = ?`
  const params: any[] = [user.sub]
  
  if (unreadOnly) {
    sql += ' AND read = 0'
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const rows = await all(c.env, sql, ...params)
  
  const unreadCount = await one<any>(
    c.env,
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`,
    user.sub
  )
  
  return c.json({
    notifications: rows,
    unreadCount: unreadCount?.count || 0
  })
})

// Mark notification as read
notifications.patch('/:id/read', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  await run(
    c.env,
    `UPDATE notifications SET read = 1, read_at = ? WHERE id = ? AND user_id = ?`,
    Date.now(),
    id,
    user.sub
  )
  
  return c.json({ ok: true })
})

// Mark all notifications as read
notifications.post('/read-all', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  await run(
    c.env,
    `UPDATE notifications SET read = 1, read_at = ? WHERE user_id = ? AND read = 0`,
    Date.now(),
    user.sub
  )
  
  return c.json({ ok: true })
})

// Delete notification
notifications.delete('/:id', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const id = c.req.param('id')
  
  await run(c.env, 'DELETE FROM notifications WHERE id = ? AND user_id = ?', id, user.sub)
  return c.json({ ok: true })
})

// Process email queue (scheduled task)
notifications.post('/process-email-queue', async c => {
  const pending = await all(
    c.env,
    `SELECT * FROM email_queue WHERE status = 'pending' LIMIT 100`
  )
  
  let processed = 0
  
  for (const email of pending as any[]) {
    try {
      // Here you would integrate with your email service
      // Example with Resend API:
      // const response = await fetch('https://api.resend.com/emails', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     from: 'notifications@yourdomain.com',
      //     to: email.recipient,
      //     subject: email.subject,
      //     html: email.body
      //   })
      // })
      
      // For now, just mark as sent
      await run(
        c.env,
        `UPDATE email_queue SET status = 'sent', sent_at = ? WHERE id = ?`,
        Date.now(),
        email.id
      )
      
      processed++
    } catch (error) {
      await run(
        c.env,
        `UPDATE email_queue SET status = 'failed', error = ? WHERE id = ?`,
        String(error),
        email.id
      )
    }
  }
  
  return c.json({ processed })
})

// Helper function to notify task assignee
export async function notifyTaskAssigned(
  env: Env,
  taskId: string,
  assigneeId: string,
  assignedBy: string
) {
  const task = await one<any>(env, 'SELECT title, key FROM tasks WHERE id = ? LIMIT 1', taskId)
  const assigner = await one<any>(env, 'SELECT name FROM users WHERE id = ? LIMIT 1', assignedBy)
  
  if (task && assigner) {
    await createNotification(
      env,
      assigneeId,
      'task.assigned',
      'Task Assigned',
      `${assigner.name} assigned you to task ${task.key}: ${task.title}`,
      'task',
      taskId,
      `/tasks/${taskId}`
    )
  }
}

// Helper function to notify on comment mention
export async function notifyMention(
  env: Env,
  userId: string,
  taskId: string,
  mentionedBy: string,
  commentBody: string
) {
  const task = await one<any>(env, 'SELECT title, key FROM tasks WHERE id = ? LIMIT 1', taskId)
  const commenter = await one<any>(env, 'SELECT name FROM users WHERE id = ? LIMIT 1', mentionedBy)
  
  if (task && commenter) {
    await createNotification(
      env,
      userId,
      'comment.mention',
      'Mentioned in Comment',
      `${commenter.name} mentioned you in ${task.key}: ${commentBody.substring(0, 100)}...`,
      'task',
      taskId,
      `/tasks/${taskId}`
    )
  }
}

// Helper function to notify on task due soon
export async function notifyDueSoon(env: Env, taskId: string) {
  const task = await one<any>(
    env,
    `SELECT t.*, t.assignee_id FROM tasks t WHERE t.id = ? LIMIT 1`,
    taskId
  )
  
  if (task && task.assignee_id) {
    await createNotification(
      env,
      task.assignee_id,
      'task.due_soon',
      'Task Due Soon',
      `Task ${task.key}: ${task.title} is due soon`,
      'task',
      taskId,
      `/tasks/${taskId}`
    )
  }
}

// Helper function to notify on task overdue
export async function notifyOverdue(env: Env, taskId: string) {
  const task = await one<any>(
    env,
    `SELECT t.*, t.assignee_id FROM tasks t WHERE t.id = ? LIMIT 1`,
    taskId
  )
  
  if (task && task.assignee_id) {
    await createNotification(
      env,
      task.assignee_id,
      'task.overdue',
      'Task Overdue',
      `Task ${task.key}: ${task.title} is now overdue`,
      'task',
      taskId,
      `/tasks/${taskId}`
    )
  }
}

export default notifications
export { createNotification, sendEmail }
