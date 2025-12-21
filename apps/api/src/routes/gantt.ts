import { Hono } from 'hono'
import { requireScope } from '../middleware'
import { all, run, one } from '../db'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

const gantt = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

// Get Gantt chart data for a project
gantt.get('/project/:projectId', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  // Get all tasks with their dependencies
  const tasks = await all(
    c.env,
    `SELECT 
       t.id,
       t.key,
       t.title,
       t.description,
       t.status,
       t.priority,
       t.due_date,
       t.created_at,
       t.assignee_id,
       t.estimate_minutes,
       u.name as assignee_name,
       u.avatar_url as assignee_avatar
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.project_id = ?
     ORDER BY t.rank ASC`,
    projectId
  )
  
  // Get dependencies
  const dependencies = await all(
    c.env,
    `SELECT 
       td.task_id,
       td.depends_on_task_id,
       td.dependency_type
     FROM task_dependencies td
     JOIN tasks t ON td.task_id = t.id
     WHERE t.project_id = ?`,
    projectId
  )
  
  // Calculate start dates based on dependencies
  const taskMap = new Map(tasks.map((t: any) => [t.id, t]))
  const processedTasks = tasks.map((task: any) => {
    const deps = (dependencies as any[]).filter(d => d.task_id === task.id)
    
    // Calculate earliest start date based on dependencies
    let startDate = task.created_at
    
    if (deps.length > 0 && deps[0].dependency_type === 'blocked_by') {
      // Find the latest due date of blocking tasks
      const blockingTasks = deps
        .map(d => taskMap.get(d.depends_on_task_id))
        .filter(t => t?.due_date)
      
      if (blockingTasks.length > 0) {
        startDate = Math.max(...blockingTasks.map((t: any) => t.due_date))
      }
    }
    
    // Calculate end date
    const duration = task.estimate_minutes || 480 // Default 1 day (8 hours)
    const endDate = task.due_date || (startDate + duration * 60 * 1000)
    
    return {
      id: task.id,
      key: task.key,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee_id ? {
        id: task.assignee_id,
        name: task.assignee_name,
        avatar: task.assignee_avatar
      } : null,
      startDate,
      endDate,
      duration: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)), // days
      progress: task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0,
      dependencies: deps.map((d: any) => ({
        taskId: d.depends_on_task_id,
        type: d.dependency_type
      }))
    }
  })
  
  // Calculate project timeline
  const allDates = processedTasks
    .flatMap((t: any) => [t.startDate, t.endDate])
    .filter((d: number) => d > 0)
  
  const projectStart = allDates.length > 0 ? Math.min(...allDates) : Date.now()
  const projectEnd = allDates.length > 0 ? Math.max(...allDates) : Date.now() + 30 * 24 * 60 * 60 * 1000
  
  return c.json({
    tasks: processedTasks,
    timeline: {
      start: projectStart,
      end: projectEnd,
      duration: Math.ceil((projectEnd - projectStart) / (1000 * 60 * 60 * 24))
    }
  })
})

// Get critical path analysis
gantt.get('/project/:projectId/critical-path', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  // Get all tasks with dependencies
  const tasks = await all(
    c.env,
    `SELECT 
       t.id,
       t.key,
       t.title,
       t.estimate_minutes,
       t.due_date,
       t.status
     FROM tasks t
     WHERE t.project_id = ?
     ORDER BY t.rank ASC`,
    projectId
  )
  
  const dependencies = await all(
    c.env,
    `SELECT 
       td.task_id,
       td.depends_on_task_id
     FROM task_dependencies td
     JOIN tasks t ON td.task_id = t.id
     WHERE t.project_id = ? AND td.dependency_type = 'blocked_by'`,
    projectId
  )
  
  // Build dependency graph
  const graph = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  
  for (const task of tasks as any[]) {
    graph.set(task.id, [])
    inDegree.set(task.id, 0)
  }
  
  for (const dep of dependencies as any[]) {
    graph.get(dep.depends_on_task_id)?.push(dep.task_id)
    inDegree.set(dep.task_id, (inDegree.get(dep.task_id) || 0) + 1)
  }
  
  // Calculate earliest start times (topological sort)
  const earliestStart = new Map<string, number>()
  const queue: string[] = []
  
  for (const [taskId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(taskId)
      earliestStart.set(taskId, 0)
    }
  }
  
  while (queue.length > 0) {
    const taskId = queue.shift()!
    const task = (tasks as any[]).find(t => t.id === taskId)
    const duration = (task?.estimate_minutes || 480) / 60 / 24 // convert to days
    const start = earliestStart.get(taskId) || 0
    
    for (const nextId of graph.get(taskId) || []) {
      const nextStart = start + duration
      earliestStart.set(nextId, Math.max(earliestStart.get(nextId) || 0, nextStart))
      
      inDegree.set(nextId, (inDegree.get(nextId) || 0) - 1)
      if (inDegree.get(nextId) === 0) {
        queue.push(nextId)
      }
    }
  }
  
  // Find critical path (tasks with zero slack)
  const criticalPath: any[] = []
  const projectDuration = Math.max(...Array.from(earliestStart.values()), 0)
  
  for (const task of tasks as any[]) {
    const start = earliestStart.get(task.id) || 0
    const duration = (task.estimate_minutes || 480) / 60 / 24
    const end = start + duration
    const slack = projectDuration - end
    
    if (slack < 1) { // Critical or near-critical
      criticalPath.push({
        id: task.id,
        key: task.key,
        title: task.title,
        duration,
        slack,
        status: task.status
      })
    }
  }
  
  return c.json({
    criticalPath,
    projectDuration,
    completedCritical: criticalPath.filter((t: any) => t.status === 'done').length,
    totalCritical: criticalPath.length
  })
})

// Get resource allocation over time
gantt.get('/project/:projectId/resources', requireScope('tasks:read'), async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const projectId = c.req.param('projectId')
  
  const tasks = await all(
    c.env,
    `SELECT 
       t.assignee_id,
       u.name as assignee_name,
       t.due_date,
       t.estimate_minutes,
       t.status
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.project_id = ? AND t.assignee_id IS NOT NULL
     ORDER BY t.due_date ASC`,
    projectId
  )
  
  // Group by assignee
  const resourceMap = new Map<string, any>()
  
  for (const task of tasks as any[]) {
    if (!resourceMap.has(task.assignee_id)) {
      resourceMap.set(task.assignee_id, {
        id: task.assignee_id,
        name: task.assignee_name,
        totalHours: 0,
        completedHours: 0,
        taskCount: 0,
        completedCount: 0
      })
    }
    
    const resource = resourceMap.get(task.assignee_id)
    const hours = (task.estimate_minutes || 0) / 60
    
    resource.totalHours += hours
    resource.taskCount += 1
    
    if (task.status === 'done') {
      resource.completedHours += hours
      resource.completedCount += 1
    }
  }
  
  return c.json({
    resources: Array.from(resourceMap.values()).map(r => ({
      ...r,
      utilization: r.totalHours > 0 ? Math.round((r.completedHours / r.totalHours) * 100) : 0
    }))
  })
})

export default gantt
