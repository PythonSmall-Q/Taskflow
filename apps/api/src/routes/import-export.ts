import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const importExport = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// Export project to JSON
importExport.get('/export/json/:projectId', requireScope('projects:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  // Get project
  const project = await one<any>(
    c.env,
    `SELECT p.* FROM projects p
     JOIN team_members m ON m.team_id = p.team_id
     WHERE p.id = ? AND m.user_id = ?
     LIMIT 1`,
    projectId,
    user.sub
  )
  
  if (!project) return c.json({ error: 'Project not found' }, 404)
  
  // Get all tasks
  const tasks = await all(
    c.env,
    `SELECT * FROM tasks WHERE project_id = ? ORDER BY rank ASC`,
    projectId
  )
  
  // Get all comments for tasks
  const taskIds = (tasks as any[]).map(t => t.id)
  const comments = taskIds.length > 0 ? await all(
    c.env,
    `SELECT c.*, u.name as author_name, u.email as author_email
     FROM comments c
     LEFT JOIN users u ON c.user_id = u.id
     WHERE c.task_id IN (${taskIds.map(() => '?').join(',')})
     ORDER BY c.created_at ASC`,
    ...taskIds
  ) : []
  
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description,
      color: project.color
    },
    tasks: (tasks as any[]).map(task => ({
      key: task.key,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      labels: task.labels ? JSON.parse(task.labels) : [],
      dueDate: task.due_date ? new Date(task.due_date).toISOString() : null,
      estimateMinutes: task.estimate_minutes,
      comments: (comments as any[])
        .filter(c => c.task_id === task.id)
        .map(c => ({
          author: c.author_name,
          authorEmail: c.author_email,
          body: c.body,
          createdAt: new Date(c.created_at).toISOString()
        }))
    }))
  }
  
  return c.json(exportData)
})

// Export project to CSV
importExport.get('/export/csv/:projectId', requireScope('projects:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  const tasks = await all(
    c.env,
    `SELECT 
       t.key,
       t.title,
       t.description,
       t.status,
       t.priority,
       t.labels,
       t.due_date,
       t.estimate_minutes,
       u.name as assignee,
       t.created_at
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.project_id = ?
     ORDER BY t.rank ASC`,
    projectId
  )
  
  const headers = ['Key', 'Title', 'Description', 'Status', 'Priority', 'Labels', 'Due Date', 'Estimate (hours)', 'Assignee', 'Created']
  const rows = (tasks as any[]).map(t => [
    t.key,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.status,
    t.priority || '',
    t.labels ? `"${JSON.parse(t.labels).join(', ')}"` : '',
    t.due_date ? new Date(t.due_date).toISOString() : '',
    t.estimate_minutes ? (t.estimate_minutes / 60).toFixed(1) : '',
    t.assignee || '',
    new Date(t.created_at).toISOString()
  ])
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv',
      'content-disposition': `attachment; filename="taskflow-export-${projectId}.csv"`
    }
  })
})

// Import tasks from JSON
importExport.post('/import/json/:projectId', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  const body = await c.req.json()
  const { tasks } = body
  
  if (!Array.isArray(tasks)) {
    return c.json({ error: 'tasks must be an array' }, 400)
  }
  
  let imported = 0
  let failed = 0
  
  for (const task of tasks) {
    try {
      const id = crypto.randomUUID()
      const key = await c.env.CACHE.get('task-counter')
      let num = key ? parseInt(key, 10) : 0
      num += 1
      await c.env.CACHE.put('task-counter', String(num))
      const taskKey = `TASK-${num.toString().padStart(4, '0')}`
      
      await run(
        c.env,
        `INSERT INTO tasks (id, project_id, title, description, labels, priority, due_date, estimate_minutes, status, key, rank, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        projectId,
        task.title || 'Untitled',
        task.description || '',
        task.labels ? JSON.stringify(task.labels) : null,
        task.priority || 'medium',
        task.dueDate ? new Date(task.dueDate).getTime() : null,
        task.estimateMinutes || null,
        task.status || 'todo',
        taskKey,
        Date.now(),
        Date.now()
      )
      
      imported++
    } catch (error) {
      failed++
    }
  }
  
  return c.json({ imported, failed, total: tasks.length })
})

// Import tasks from CSV
importExport.post('/import/csv/:projectId', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  const formData = await c.req.formData()
  const file = formData.get('file')
  
  if (!file || typeof file === 'string') {
    return c.json({ error: 'CSV file required' }, 400)
  }
  
  const text = await (file as File).text()
  const lines = text.split('\n').filter(l => l.trim())
  
  if (lines.length < 2) {
    return c.json({ error: 'CSV must have headers and at least one row' }, 400)
  }
  
  // Parse CSV (simple implementation, doesn't handle complex quoted fields)
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows = lines.slice(1)
  
  let imported = 0
  let failed = 0
  
  for (const row of rows) {
    try {
      const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const task: any = {}
      
      headers.forEach((header, i) => {
        task[header] = values[i] || ''
      })
      
      const id = crypto.randomUUID()
      const key = await c.env.CACHE.get('task-counter')
      let num = key ? parseInt(key, 10) : 0
      num += 1
      await c.env.CACHE.put('task-counter', String(num))
      const taskKey = `TASK-${num.toString().padStart(4, '0')}`
      
      await run(
        c.env,
        `INSERT INTO tasks (id, project_id, title, description, labels, priority, due_date, estimate_minutes, status, key, rank, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        projectId,
        task.title || 'Untitled',
        task.description || '',
        task.labels ? JSON.stringify(task.labels.split(',').map((l: string) => l.trim())) : null,
        task.priority || 'medium',
        task['due date'] ? new Date(task['due date']).getTime() : null,
        task['estimate (hours)'] ? parseFloat(task['estimate (hours)']) * 60 : null,
        task.status || 'todo',
        taskKey,
        Date.now(),
        Date.now()
      )
      
      imported++
    } catch (error) {
      failed++
    }
  }
  
  return c.json({ imported, failed, total: rows.length })
})

// Import from Jira export
importExport.post('/import/jira/:projectId', requireScope('tasks:write'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  const body = await c.req.json()
  const { issues } = body
  
  if (!Array.isArray(issues)) {
    return c.json({ error: 'issues must be an array' }, 400)
  }
  
  let imported = 0
  let failed = 0
  
  const priorityMap: any = {
    'Highest': 'urgent',
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low',
    'Lowest': 'low'
  }
  
  const statusMap: any = {
    'To Do': 'todo',
    'In Progress': 'in_progress',
    'In Review': 'review',
    'Done': 'done',
    'Closed': 'done'
  }
  
  for (const issue of issues) {
    try {
      const id = crypto.randomUUID()
      const key = await c.env.CACHE.get('task-counter')
      let num = key ? parseInt(key, 10) : 0
      num += 1
      await c.env.CACHE.put('task-counter', String(num))
      const taskKey = `TASK-${num.toString().padStart(4, '0')}`
      
      const priority = priorityMap[issue.fields?.priority?.name] || 'medium'
      const status = statusMap[issue.fields?.status?.name] || 'todo'
      const labels = issue.fields?.labels || []
      
      await run(
        c.env,
        `INSERT INTO tasks (id, project_id, title, description, labels, priority, due_date, estimate_minutes, status, key, rank, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        projectId,
        issue.fields?.summary || 'Untitled',
        issue.fields?.description || '',
        labels.length > 0 ? JSON.stringify(labels) : null,
        priority,
        issue.fields?.duedate ? new Date(issue.fields.duedate).getTime() : null,
        issue.fields?.timeoriginalestimate ? Math.floor(issue.fields.timeoriginalestimate / 60) : null,
        status,
        taskKey,
        Date.now(),
        Date.now()
      )
      
      imported++
    } catch (error) {
      failed++
    }
  }
  
  return c.json({ imported, failed, total: issues.length })
})

export default importExport
