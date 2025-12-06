import { Hono } from 'hono'
import type { AppContext } from '../types'

export const integrations = new Hono<AppContext>()

// Slack/Discord webhook notify stub
integrations.post('/notify', async c => {
  const body = await c.req.json()
  const url = body.url as string
  const payload = body.payload || { text: 'Hello from Taskflow' }
  if (!url) return c.json({ error: 'Missing url' }, 400)
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  return c.json({ ok: res.ok })
})

// Helper to fan-out notifications to Slack/Discord when notify.user triggers
export async function broadcastToHooks(env: Env, teamId: string, text: string) {
  const hooks = await env.DB.prepare('SELECT url FROM webhooks WHERE team_id = ? AND active = 1').bind(teamId).all<{ url: string }>()
  const urls = (hooks.results || []).map(h => h.url).filter(u => /slack|discord|hooks/.test(u))
  await Promise.all(urls.map(u => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })))
}

// GitHub/GitLab sync stub
integrations.post('/sync', async c => {
  const body = await c.req.json()
  // TODO: use provider tokens to create/update issues based on tasks
  return c.json({ ok: true })
})

// Google Calendar stub
integrations.post('/calendar', async c => {
  const body = await c.req.json()
  const token = body.accessToken as string | undefined
  const summary = body.summary as string
  const start = body.start as string // ISO datetime
  const end = body.end as string // ISO datetime
  const timezone = body.timezone as string || 'UTC'
  if (!summary || !start || !end) return c.json({ error: 'Missing summary/start/end' }, 400)
  if (!token) return c.json({ error: 'Missing accessToken' }, 400)
  // Create Google Calendar event
  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      summary,
      start: { dateTime: start, timeZone: timezone },
      end: { dateTime: end, timeZone: timezone }
    })
  })
  const data = await resp.json()
  return c.json({ ok: resp.ok, event: data })
})
