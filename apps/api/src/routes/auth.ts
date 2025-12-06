import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, JWTPayload } from '../types'
import { all, one, run } from '../db'
import { hashPassword, signJWT, verifyPassword } from '../utils'

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1) })
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })

export const auth = new Hono<{ Bindings: Env; Variables: { user?: JWTPayload } }>()

auth.post('/register', async c => {
  const body = await c.req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)
  const { email, password, name } = parsed.data

  const exists = await one<{ id: string }>(c.env, 'SELECT id FROM users WHERE email = ? LIMIT 1', email)
  if (exists) return c.json({ error: 'Email already registered' }, 409)

  const { hash, salt } = await hashPassword(password)
  const id = crypto.randomUUID()

  await run(
    c.env,
    'INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?) ',
    id,
    email,
    name,
    hash,
    salt,
    Date.now()
  )

  const token = await signJWT({ sub: id, email }, c.env.JWT_SECRET)
  return c.json({ token, user: { id, email, name } })
})

auth.post('/login', async c => {
  const body = await c.req.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)
  const { email, password } = parsed.data

  const user = await one<{
    id: string
    name: string
    password_hash: string
    password_salt: string
  }>(c.env, 'SELECT id, name, password_hash, password_salt FROM users WHERE email = ? LIMIT 1', email)

  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const ok = await verifyPassword(password, user.password_hash, user.password_salt)
  if (!ok) return c.json({ error: 'Invalid credentials' }, 401)

  const token = await signJWT({ sub: user.id, email }, c.env.JWT_SECRET)
  return c.json({ token, user: { id: user.id, email, name: user.name } })
})

auth.get('/me', async c => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const payload = (await import('../utils')).then(m => m.verifyJWT(token!, c.env.JWT_SECRET))
    const { sub } = await payload
    const user = await one<{ id: string; email: string; name: string }>(c.env, 'SELECT id, email, name FROM users WHERE id = ?', sub)
    if (!user) return c.json({ error: 'Not found' }, 404)
    return c.json({ user })
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
