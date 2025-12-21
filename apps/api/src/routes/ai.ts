import { Hono } from 'hono'
import type { AppContext } from '../types'
import { all, one } from '../db'
import { getBearer, verifyJWT } from '../utils'

export const ai = new Hono<AppContext>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

ai.post('/auto-tag', async c => {
  const body = await c.req.json()
  const text = (body?.title ?? '') + '\n' + (body?.description ?? '')
  
  try {
    // Use Workers AI for intelligent tag suggestion
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a task management assistant. Suggest 3-5 relevant tags for the given task. Return only tag names separated by commas, lowercase, no spaces in tags.'
        },
        {
          role: 'user',
          content: `Task: ${text}\n\nSuggest relevant tags:`
        }
      ]
    })
    
    const tags = (response as any).response
      .split(',')
      .map((t: string) => t.trim().toLowerCase())
      .filter((t: string) => t.length > 0)
      .slice(0, 5)
    
    return c.json({ tags })
  } catch (error) {
    // Fallback: simple keyword extraction
    const keywords = text.toLowerCase().match(/\b\w{4,}\b/g) || []
    const commonTags = ['feature', 'bug', 'enhancement', 'documentation', 'urgent', 'low-priority']
    const tags = keywords.filter((k: string) => commonTags.includes(k)).slice(0, 3)
    
    return c.json({ tags: tags.length > 0 ? tags : ['general'] })
  }
})

ai.post('/assign', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { projectId, taskPriority } = body
  
  if (!projectId) return c.json({ error: 'projectId required' }, 400)
  
  // Get team members with their current workload
  const members = await all(
    c.env,
    `SELECT 
       u.id,
       u.name,
       COUNT(t.id) as task_count,
       SUM(CASE WHEN t.priority = 'urgent' THEN 3 WHEN t.priority = 'high' THEN 2 ELSE 1 END) as workload_score
     FROM users u
     JOIN team_members tm ON u.id = tm.user_id
     JOIN projects p ON tm.team_id = p.team_id
     LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done'
     WHERE p.id = ?
     GROUP BY u.id
     ORDER BY workload_score ASC, task_count ASC
     LIMIT 5`,
    projectId
  )
  
  if ((members as any[]).length === 0) {
    return c.json({ assigneeUserId: null, reason: 'No team members found' })
  }
  
  // Suggest the person with lowest workload
  const suggested = (members as any[])[0]
  
  return c.json({
    assigneeUserId: suggested.id,
    assigneeName: suggested.name,
    currentWorkload: suggested.task_count,
    reason: `Lowest workload (${suggested.task_count} active tasks)`
  })
})

// Predict task priority based on title and description
ai.post('/predict-priority', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { title, description } = body
  
  if (!title) return c.json({ error: 'title required' }, 400)
  
  try {
    const text = `${title}\n${description || ''}`
    
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a task management assistant. Analyze the task and predict its priority level. Respond with ONLY one word: low, medium, high, or urgent.'
        },
        {
          role: 'user',
          content: `Task: ${text}\n\nPriority:`
        }
      ]
    })
    
    const priority = (response as any).response.trim().toLowerCase()
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    
    return c.json({
      priority: validPriorities.includes(priority) ? priority : 'medium',
      confidence: 0.85
    })
  } catch (error) {
    // Fallback: keyword-based priority detection
    const text = `${title} ${description || ''}`.toLowerCase()
    
    if (text.match(/urgent|critical|asap|emergency|blocker/)) {
      return c.json({ priority: 'urgent', confidence: 0.7 })
    } else if (text.match(/important|high|priority|soon/)) {
      return c.json({ priority: 'high', confidence: 0.6 })
    } else if (text.match(/low|minor|trivial|someday/)) {
      return c.json({ priority: 'low', confidence: 0.6 })
    }
    
    return c.json({ priority: 'medium', confidence: 0.5 })
  }
})

// Suggest task deadline based on priority and workload
ai.post('/suggest-deadline', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { projectId, priority, estimateMinutes } = body
  
  if (!projectId) return c.json({ error: 'projectId required' }, 400)
  
  // Get project's average completion time
  const stats = await one<any>(
    c.env,
    `SELECT 
       AVG(CASE WHEN status = 'done' THEN created_at - due_date ELSE NULL END) as avg_completion_delta,
       COUNT(CASE WHEN status != 'done' AND due_date < ? THEN 1 END) as overdue_count
     FROM tasks
     WHERE project_id = ?`,
    Date.now(),
    projectId
  )
  
  const now = Date.now()
  let suggestedDays = 7 // default 1 week
  
  // Adjust based on priority
  switch (priority) {
    case 'urgent':
      suggestedDays = 1
      break
    case 'high':
      suggestedDays = 3
      break
    case 'medium':
      suggestedDays = 7
      break
    case 'low':
      suggestedDays = 14
      break
  }
  
  // Adjust based on estimate
  if (estimateMinutes) {
    const estimatedDays = Math.ceil(estimateMinutes / 480) // 480 min = 8 hours = 1 day
    suggestedDays = Math.max(suggestedDays, estimatedDays)
  }
  
  // Add buffer if project has many overdue tasks
  if (stats && stats.overdue_count > 5) {
    suggestedDays = Math.ceil(suggestedDays * 1.5)
  }
  
  const suggestedDeadline = now + (suggestedDays * 24 * 60 * 60 * 1000)
  
  return c.json({
    suggestedDeadline,
    suggestedDays,
    reason: `Based on ${priority} priority${estimateMinutes ? ` and ${estimateMinutes} min estimate` : ''}${stats?.overdue_count > 5 ? ' (buffer added due to project overdue tasks)' : ''}`
  })
})

// Estimate task completion time using AI
ai.post('/estimate-time', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { title, description, projectId } = body
  
  if (!title) return c.json({ error: 'title required' }, 400)
  
  try {
    const text = `${title}\n${description || ''}`
    
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a project estimation expert. Estimate how many hours this task will take. Respond with ONLY a number (hours as decimal, e.g., 2.5 for 2.5 hours).'
        },
        {
          role: 'user',
          content: `Task: ${text}\n\nEstimated hours:`
        }
      ]
    })
    
    const hours = parseFloat((response as any).response.trim())
    
    if (isNaN(hours) || hours <= 0) {
      throw new Error('Invalid AI response')
    }
    
    return c.json({
      estimateMinutes: Math.round(hours * 60),
      estimateHours: hours,
      confidence: 0.75
    })
  } catch (error) {
    // Fallback: use historical project data
    if (projectId) {
      const avgEstimate = await one<any>(
        c.env,
        `SELECT AVG(estimate_minutes) as avg_minutes
         FROM tasks
         WHERE project_id = ? AND estimate_minutes IS NOT NULL`,
        projectId
      )
      
      if (avgEstimate && avgEstimate.avg_minutes) {
        return c.json({
          estimateMinutes: Math.round(avgEstimate.avg_minutes),
          estimateHours: Math.round(avgEstimate.avg_minutes / 60 * 10) / 10,
          confidence: 0.6,
          reason: 'Based on project average'
        })
      }
    }
    
    // Default estimate
    return c.json({
      estimateMinutes: 240, // 4 hours
      estimateHours: 4,
      confidence: 0.4,
      reason: 'Default estimate'
    })
  }
})

// Generate task description from title using AI
ai.post('/generate-description', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  
  const body = await c.req.json()
  const { title } = body
  
  if (!title) return c.json({ error: 'title required' }, 400)
  
  try {
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a technical writer. Generate a clear, concise task description with acceptance criteria. Use markdown format with sections: ## Description, ## Acceptance Criteria (bullet points).'
        },
        {
          role: 'user',
          content: `Task title: ${title}\n\nGenerate description:`
        }
      ]
    })
    
    return c.json({
      description: (response as any).response.trim()
    })
  } catch (error) {
    return c.json({
      description: `## Description\n\n${title}\n\n## Acceptance Criteria\n\n- [ ] Complete the task\n- [ ] Test the implementation\n- [ ] Update documentation`
    })
  }
})
