import { Hono } from 'hono'
import type { AppContext } from '../types'
import { all } from '../db'

export const reports = new Hono<AppContext>()

reports.get('/burnup/:projectId', async c => {
  const projectId = c.req.param('projectId')
  const from = c.req.query('from') ? new Date(c.req.query('from')!).getTime() : undefined
  const to = c.req.query('to') ? new Date(c.req.query('to')!).getTime() : undefined
  const tasks = await all<{ status: string; created_at: number }>(
    c.env,
    'SELECT status, created_at FROM tasks WHERE project_id = ?',
    projectId
  )
  const filtered = tasks.filter(t => {
    const ts = t.created_at
    if (from && ts < from) return false
    if (to && ts > to) return false
    return true
  })
  // Simple burnup: cumulative created vs done over time buckets (daily)
  const day = 86400000
  const start = (filtered.length ? Math.min(...filtered.map(t => t.created_at)) : Date.now())
  const end = (filtered.length ? Math.max(...filtered.map(t => t.created_at)) : start)
  const buckets: Record<string, { created: number; done: number; cumulativeCreated: number; cumulativeDone: number }> = {}
  let cumulativeCreated = 0
  let cumulativeDone = 0
  for (const t of filtered) {
    const d = new Date(Math.floor((t.created_at - start) / day) * day + start).toISOString().slice(0, 10)
    buckets[d] ??= { created: 0, done: 0, cumulativeCreated: 0, cumulativeDone: 0 }
    buckets[d].created += 1
    if (t.status === 'done') buckets[d].done += 1
  }
  // compute cumulative series in date order
  const dates = Object.keys(buckets).sort()
  for (const d of dates) {
    const v = buckets[d]
    cumulativeCreated += v.created
    cumulativeDone += v.done
    v.cumulativeCreated = cumulativeCreated
    v.cumulativeDone = cumulativeDone
  }
  return c.json({
    range: { start, end },
    series: dates.map(date => ({ date, ...buckets[date] }))
  })
})

reports.get('/workload/:teamId', async c => {
  const teamId = c.req.param('teamId')
  // Per-user open task counts by status
  const rows = await all(c.env, `
    SELECT t.assignee_id as user_id,
           SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo,
           SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END) as review,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done,
           COUNT(*) as total
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE p.team_id = ?
    GROUP BY t.assignee_id
  `, teamId)
  return c.json({ workload: rows })
})
