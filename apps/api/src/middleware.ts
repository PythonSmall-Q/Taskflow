import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppContext, JWTPayload } from './types'
import { one } from './db'
import { getBearer, verifyJWT } from './utils'
import { jwtVerify, createRemoteJWKSet } from 'jose'

export const withCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
})

export const authMiddleware = new Hono<AppContext>()
  .use('*', async (c, next) => {
      const apiKey = c.req.header('x-api-key')
      if (apiKey) {
        const row = await one<{ user_id: string; scopes: string }>(c.env, 'SELECT user_id, scopes FROM api_keys WHERE key = ? AND revoked = 0', apiKey)
        if (!row) return c.json({ error: 'Invalid API key' }, 401)
        c.set('user', { id: row.user_id, scopes: row.scopes ? JSON.parse(row.scopes) : [] })
        return await next()
      }
      const token = getBearer(c.req.raw)
      if (!token) return c.json({ error: 'Unauthorized' }, 401)
      try {
        const payload = await verifyJWT(token, c.env.JWT_SECRET)
        c.set('user', payload as JWTPayload)
        await next()
      } catch {
        return c.json({ error: 'Invalid token' }, 401)
    }
  })

// Validate Cloudflare Access JWT if present (cf-access-jwt-assertion)
export const accessMiddleware = new Hono<AppContext>()
  .use('*', async (c, next) => {
    const cfJwt = c.req.header('cf-access-jwt-assertion')
    if (!cfJwt) return next()
    // Verify against Cloudflare Access JWKs endpoint
    const jwksUrl = (await c.env.CACHE.get('ACCESS_JWKS_URL')) || c.env.ACCESS_JWKS_URL
    if (!jwksUrl) return c.json({ error: 'Access JWKs not configured' }, 500)
    try {
      const JWKS = createRemoteJWKSet(new URL(jwksUrl))
      const { payload } = await jwtVerify(cfJwt, JWKS)
      c.set('access', payload)
      const email = (payload as any).email as string | undefined
      if (email) {
        const { upsertUserByEmail } = await import('./db')
        const user = await upsertUserByEmail(c.env, email, (payload as any).name || 'Access User')
        c.set('user', { sub: user.id, email, exp: Math.floor(Date.now()/1000)+3600 })
      }
      return next()
    } catch (e) {
      return c.json({ error: 'Invalid Access token' }, 401)
    }
  })

// Simple KV-based rate limit: X requests per window per token/IP
export function rateLimit(limit = 100, windowMs = 60_000) {
  return async (c: any, next: any) => {
    const apiKey = c.req.header('x-api-key')
    const user = c.get('user') as { id?: string } | undefined
    let effectiveLimit = limit
    if (apiKey) {
      const row = await one<{ limit_per_minute: number | null }>(c.env, 'SELECT limit_per_minute FROM api_keys WHERE key = ? AND revoked = 0', apiKey)
      if (row && row.limit_per_minute && row.limit_per_minute > 0) effectiveLimit = row.limit_per_minute
    }
    const keyBase = apiKey || user?.id || c.req.header('authorization') || c.req.header('cf-connecting-ip') || 'anon'
    const bucket = `rl:${Math.floor(Date.now() / windowMs)}:${keyBase}`
    const current = parseInt((await c.env.CACHE.get(bucket)) || '0', 10)
    if (current >= effectiveLimit) return c.json({ error: 'Rate limit exceeded' }, 429)
    await c.env.CACHE.put(bucket, String(current + 1), { expirationTtl: Math.ceil(windowMs / 1000) })
    return next()
  }
}

// Scope guard for API key usage
export function requireScope(scope: string) {
  return async (c: any, next: any) => {
    const apiKey = c.req.header('x-api-key')
    if (!apiKey) return next()
    const user = c.get('user') as { scopes?: string[] }
    const scopes = user?.scopes || []
    if (!scopes.includes(scope)) return c.json({ error: 'Insufficient scope' }, 403)
    return next()
  }
}
