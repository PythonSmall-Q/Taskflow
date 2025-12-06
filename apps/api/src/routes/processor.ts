import { Hono } from 'hono'
import type { AppContext } from '../types'
import { all, run } from '../db'
import { callWebhook as callHook } from './tasks'

export const processor = new Hono<AppContext>()

// Process due tasks and fire automations
processor.post('/process-due', async c => {
  const now = Date.now()
  const soonWindow = 24 * 60 * 60 * 1000 // 24h
  const dueSoon = await all<{ id: string; project_id: string }>(c.env, `SELECT id, project_id FROM tasks WHERE status != 'done' AND due_date IS NOT NULL AND due_date BETWEEN ? AND ?`, now, now + soonWindow)
  const overdue = await all<{ id: string; project_id: string }>(c.env, `SELECT id, project_id FROM tasks WHERE status != 'done' AND due_date IS NOT NULL AND due_date < ?`, now)
  for (const t of dueSoon) {
    await fire(c.env, t.project_id, 'task.due_soon', { id: t.id })
  }
  for (const t of overdue) {
    await fire(c.env, t.project_id, 'task.overdue', { id: t.id })
  }
  return c.json({ ok: true, counts: { dueSoon: dueSoon.length, overdue: overdue.length } })
})

async function fire(env: Env, projectId: string, trigger: string, payload: any) {
  const proj = await env.DB.prepare('SELECT team_id FROM projects WHERE id = ?').bind(projectId).first<{ team_id: string }>()
  if (!proj) return
  const rules = await all<{ id: string; action: string; config: string }>(env, 'SELECT id, action, config FROM automations WHERE team_id = ? AND trigger = ? AND active = 1', proj.team_id, trigger)
  for (const r of rules) {
    const cfg = JSON.parse(r.config || '{}')
    if (r.action === 'webhook.call') await callHook(env, proj.team_id, trigger, payload, cfg)
    if (r.action === 'notify.user') await enqueue(env, proj.team_id, payload, cfg)
  }
}

async function enqueue(env: Env, teamId: string, payload: any, cfg: any) {
  const users = await all<{ user_id: string }>(env, 'SELECT user_id FROM team_members WHERE team_id = ?', teamId)
  for (const u of users) {
    await run(env, 'INSERT INTO notifications (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), u.user_id, cfg?.type || 'due', JSON.stringify(payload), Date.now())
  }
}
