import { Hono } from 'hono'
import type { Env } from '../types'

export const realtime = new Hono<{ Bindings: Env }>()

realtime.get('/room/:id', async c => {
  const id = c.req.param('id')
  const stub = c.env.ROOM_DO.idFromName(id)
  const obj = c.env.ROOM_DO.get(stub)
  return obj.fetch(new Request('http://do/connect', { method: 'GET' }))
})
