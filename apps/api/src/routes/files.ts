import { Hono } from 'hono'
import type { Env } from '../types'
import { getBearer, verifyJWT } from '../utils'

export const files = new Hono<{ Bindings: Env }>()

async function auth(c: any) {
  const token = getBearer(c.req.raw)
  if (!token) return null
  try { return await verifyJWT(token, c.env.JWT_SECRET) } catch { return null }
}

files.post('/', async c => {
  const user = await auth(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const form = await c.req.parseBody()
  const file = form['file'] as File | undefined
  if (!file) return c.json({ error: 'No file' }, 400)
  const key = `${user.sub}/${Date.now()}-${file.name}`
  await c.env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })
  return c.json({ key, url: `/files/${encodeURIComponent(key)}` })
})

files.get('/:key{.+}', async c => {
  const key = decodeURIComponent(c.req.param('key'))
  const obj = await c.env.FILES.get(key)
  if (!obj) return c.notFound()
  return new Response(obj.body, { headers: obj.httpMetadata ? { 'content-type': obj.httpMetadata.contentType ?? 'application/octet-stream' } : {} })
})
