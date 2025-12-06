import { Hono } from 'hono'
import type { AppContext } from '../types'

export const ai = new Hono<AppContext>()

ai.post('/auto-tag', async c => {
  const body = await c.req.json()
  const text = (body?.title ?? '') + '\n' + (body?.description ?? '')
  // Workers AI example (pseudo): classify tags
  // const res = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt: `Suggest 3 tags for: ${text}` })
  // For MVP, return dummy tags
  return c.json({ tags: ['feature', 'ui', 'priority-medium'] })
})

ai.post('/assign', async c => {
  const body = await c.req.json()
  // Suggest an assignee based on workload (placeholder)
  return c.json({ assigneeUserId: null })
})
