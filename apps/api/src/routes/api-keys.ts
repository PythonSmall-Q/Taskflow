import { Hono } from 'hono'
import type { Env } from '../types'
import { all, one } from '../db'

export const apiKeys = new Hono<{ Bindings: Env }>()

apiKeys.get('/', async c => {
  const user = c.get('user') as { id: string }
  const keys = await all(c.env, 'SELECT id, key, created_at, revoked FROM api_keys WHERE user_id = ?', user.id)
  return c.json({ keys })
})

apiKeys.post('/', async c => {
  const user = c.get('user') as { id: string }
  const body = await c.req.json().catch(() => ({})) as { label?: string }
  const key = crypto.randomUUID().replace(/-/g, '')
  await c.env.DB.prepare('INSERT INTO api_keys (id, user_id, key, label, created_at, revoked) VALUES (?, ?, ?, ?, ?, 0)')
    .bind(crypto.randomUUID(), user.id, key, body.label ?? null, Date.now())
    .run()
  return c.json({ key })
})

apiKeys.post('/revoke/:id', async c => {
  const user = c.get('user') as { id: string }
  const id = c.req.param('id')
  const row = await one<{ user_id: string }>(c.env, 'SELECT user_id FROM api_keys WHERE id = ?', id)
  if (!row || row.user_id !== user.id) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('UPDATE api_keys SET revoked = 1 WHERE id = ?').bind(id).run()
  return c.json({ revoked: true })
})
