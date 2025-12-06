import { Hono } from 'hono'
import type { Env } from '../types'
import { all } from '../db'

export const reports = new Hono<{ Bindings: Env }>()

reports.get('/burnup/:projectId', async c => {
  const projectId = c.req.param('projectId')
  const tasks = await all<{ status: string; created_at: number }>(c.env, 'SELECT status, created_at FROM tasks WHERE project_id = ?', projectId)
  // Simple burnup: cumulative created vs done over time buckets (daily)
  const day = 86400000
  const start = Math.min(...tasks.map(t => t.created_at)) || Date.now()
  const buckets: Record<string, { created: number; done: number }> = {}
  for (const t of tasks) {
    const d = new Date(Math.floor((t.created_at - start) / day) * day + start).toISOString().slice(0,10)
    buckets[d] ??= { created: 0, done: 0 }
    buckets[d].created += 1
    if (t.status === 'done') buckets[d].done += 1
  }
  return c.json({ series: Object.entries(buckets).map(([date, v]) => ({ date, ...v })) })
})

reports.get('/workload/:teamId', async c => {
  const teamId = c.req.param('teamId')
  // Placeholder: per-user task counts
  const rows = await all(c.env, `SELECT user_id, COUNT(*) as count FROM (
    SELECT m.user_id FROM tasks t
    JOIN projects p ON t.project_id = p.id
    JOIN team_members m ON m.team_id = p.team_id
    WHERE p.team_id = ?
  ) GROUP BY user_id`, teamId)
  return c.json({ workload: rows })
})
