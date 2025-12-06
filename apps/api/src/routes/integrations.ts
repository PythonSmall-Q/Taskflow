import { Hono } from 'hono'
import type { Env } from '../types'

export const integrations = new Hono<{ Bindings: Env }>()

// Slack/Discord webhook notify stub
integrations.post('/notify', async c => {
  const body = await c.req.json()
  const url = body.url as string
  const payload = body.payload || { text: 'Hello from Taskflow' }
  if (!url) return c.json({ error: 'Missing url' }, 400)
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  return c.json({ ok: res.ok })
})

// GitHub/GitLab sync stub
integrations.post('/sync', async c => {
  const body = await c.req.json()
  // TODO: use provider tokens to create/update issues based on tasks
  return c.json({ ok: true })
})

// Google Calendar stub
integrations.post('/calendar', async c => {
  const body = await c.req.json()
  // TODO: post events for due tasks
  return c.json({ ok: true })
})
